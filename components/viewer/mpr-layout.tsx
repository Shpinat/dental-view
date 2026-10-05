'use client'

import { useEffect, useRef, useId } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { setupCornerstoneVolume, cleanupCornerstoneVolume } from '@/lib/cornerstone-setup';
import { useViewer } from '@/lib/viewer-store';
import type { Volume, StudyMeta } from '@/lib/types';
import { ACCENT } from '@/lib/overlay';
import { cn } from '@/lib/utils';

const VIEWPORTS = [
  { id: 'axial', label: 'Аксиальный', orientation: cornerstone.Enums.OrientationAxis.AXIAL, accent: ACCENT.axial },
  { id: 'sagittal', label: 'Сагиттальный', orientation: cornerstone.Enums.OrientationAxis.SAGITTAL, accent: ACCENT.sagittal },
  { id: 'coronal', label: 'Корональный', orientation: cornerstone.Enums.OrientationAxis.CORONAL, accent: ACCENT.coronal },
] as const;

export function MprLayout({ volume, meta }: { volume: Volume, meta: StudyMeta }) {
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const engineRef = useRef<cornerstone.RenderingEngine | null>(null);
  const toolGroupRef = useRef<any>(null);
  const localImageMetadataProviderRef = useRef<any>(null);

  const componentId = useId().replace(/:/g, '');
  const renderingEngineId = `mpr-engine-${componentId}`;
  const toolGroupId = `mpr-tools-${componentId}`;
  const volumeId = `local:dicom-volume-${meta.id}`;

  const tool = useViewer(s => s.tool);
  const defaultWl = useViewer(s => s.defaultWl);
  const resetViewsEvent = useViewer(s => s.resetViewsEvent);
  const invertEvent = useViewer(s => s.invertEvent);
  const invert = useViewer(s => s.invert);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    const setupEngine = async () => {
      try {
        if (!engineRef.current) {
          engineRef.current = new cornerstone.RenderingEngine(renderingEngineId);
        }
        const renderingEngine = engineRef.current;

        const existingViewports = renderingEngine.getViewports();
        if (existingViewports.length === 0) {
          const viewportInputs = VIEWPORTS.map(({ id, orientation }) => {
            const element = elementRefs.current[id];
            if (!element) throw new Error(`Не найдено окно ${id} для рендеринга.`);
            return {
              viewportId: id,
              type: cornerstone.Enums.ViewportType.ORTHOGRAPHIC,
              element,
              defaultOptions: {
                orientation,
                background: [0, 0, 0] as cornerstone.Types.Point3,
              },
            };
          });
          renderingEngine.setViewports(viewportInputs);
        }

        const setupResult = await setupCornerstoneVolume(volumeId, meta, volume);
        localImageMetadataProviderRef.current = setupResult.localImageMetadataProvider;

        if (disposed) return;

        const viewports = VIEWPORTS.map(({ id }) => {
          const viewport = renderingEngine.getViewport(id);
          if (!(viewport instanceof cornerstone.VolumeViewport)) {
            throw new Error(`Окно ${id} не является Volume Viewport.`);
          }
          return viewport;
        });

        await Promise.all(viewports.map((viewport) => viewport.setVolumes([{ volumeId }])));

        for (const viewport of viewports) {
          viewport.setProperties({
            voiRange: {
              lower: defaultWl.center - defaultWl.width / 2,
              upper: defaultWl.center + defaultWl.width / 2,
            },
            invert: false,
          });
        }

        if (!toolGroupRef.current) {
          // Initialize crosshairs custom class if not present
          if (!cornerstoneTools.state.tools[cornerstoneTools.CrosshairsTool.toolName]) {
             cornerstoneTools.addTool(cornerstoneTools.CrosshairsTool);
          }
          if (!cornerstoneTools.state.tools[cornerstoneTools.WindowLevelTool.toolName]) cornerstoneTools.addTool(cornerstoneTools.WindowLevelTool);
          if (!cornerstoneTools.state.tools[cornerstoneTools.PanTool.toolName]) cornerstoneTools.addTool(cornerstoneTools.PanTool);
          if (!cornerstoneTools.state.tools[cornerstoneTools.ZoomTool.toolName]) cornerstoneTools.addTool(cornerstoneTools.ZoomTool);

          let toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId) || cornerstoneTools.ToolGroupManager.createToolGroup(toolGroupId);
          if (!toolGroup) throw new Error('Не удалось создать группу инструментов Cornerstone.');
          toolGroupRef.current = toolGroup;

          for (const { id } of VIEWPORTS) toolGroup.addViewport(id, renderingEngineId);

          toolGroup.addTool(cornerstoneTools.CrosshairsTool.toolName);
          toolGroup.addTool(cornerstoneTools.WindowLevelTool.toolName);
          toolGroup.addTool(cornerstoneTools.PanTool.toolName);
          toolGroup.addTool(cornerstoneTools.ZoomTool.toolName);

          // Always bind zoom to wheel
          toolGroup.setToolActive(cornerstoneTools.ZoomTool.toolName, {
            bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Wheel }],
          });
        }

        renderingEngine.render();

        resizeObserver = new ResizeObserver(() => {
          engineRef.current?.resize(true, true);
        });
        for (const { id } of VIEWPORTS) {
          const element = elementRefs.current[id];
          if (element) resizeObserver.observe(element);
        }
      } catch (error) {
        console.error("Cornerstone setup failed", error);
      }
    };

    void setupEngine();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();

      if (localImageMetadataProviderRef.current) {
         cleanupCornerstoneVolume(volumeId, localImageMetadataProviderRef.current);
         localImageMetadataProviderRef.current = null;
      }

      if (toolGroupRef.current) {
        VIEWPORTS.forEach(({ id }) => toolGroupRef.current?.removeViewports(renderingEngineId, id));
        cornerstoneTools.ToolGroupManager.destroyToolGroup(toolGroupId);
        toolGroupRef.current = null;
      }

      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }

      cornerstone.cache.purgeCache();
    };
  }, [meta, volume, volumeId, defaultWl, renderingEngineId, toolGroupId]);

  // Effect to handle tool binding changes
  useEffect(() => {
    const toolGroup = toolGroupRef.current;
    if (!toolGroup) return;

    // Reset primary button tools
    toolGroup.setToolDisabled(cornerstoneTools.CrosshairsTool.toolName);
    toolGroup.setToolDisabled(cornerstoneTools.WindowLevelTool.toolName);
    toolGroup.setToolDisabled(cornerstoneTools.PanTool.toolName);

    // Set active tool based on toolbar
    if (tool === 'crosshair') {
       toolGroup.setToolActive(cornerstoneTools.CrosshairsTool.toolName, { bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }]});
    } else if (tool === 'wl') {
       toolGroup.setToolActive(cornerstoneTools.WindowLevelTool.toolName, { bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }]});
    } else if (tool === 'pan') {
       toolGroup.setToolActive(cornerstoneTools.PanTool.toolName, { bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }]});
    } else if (tool === 'zoom') {
        // Primary zoom
       toolGroup.setToolActive(cornerstoneTools.ZoomTool.toolName, { bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }, { mouseButton: cornerstoneTools.Enums.MouseBindings.Wheel }]});
    } else {
        // Ensure zoom is still on wheel if another tool is primary
        toolGroup.setToolActive(cornerstoneTools.ZoomTool.toolName, { bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Wheel }]});
    }

    // Always have these as secondary/auxiliary if not primary
    if (tool !== 'wl') toolGroup.setToolActive(cornerstoneTools.WindowLevelTool.toolName, { bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Secondary }]});
    if (tool !== 'pan') toolGroup.setToolActive(cornerstoneTools.PanTool.toolName, { bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Auxiliary }]});

  }, [tool]);

  // Handle reset views event
  useEffect(() => {
     if (resetViewsEvent === 0) return;
     const engine = engineRef.current;
     if (!engine) return;

     VIEWPORTS.forEach(({ id }) => {
        const viewport = engine.getViewport(id);
        if (viewport && viewport instanceof cornerstone.VolumeViewport) {
           viewport.resetCamera();
           viewport.setProperties({
              voiRange: {
                 lower: defaultWl.center - defaultWl.width / 2,
                 upper: defaultWl.center + defaultWl.width / 2,
              }
           });
        }
     });
     engine.render();
  }, [resetViewsEvent, defaultWl]);

  // Handle invert event
  useEffect(() => {
     if (invertEvent === 0) return;
     const engine = engineRef.current;
     if (!engine) return;

     VIEWPORTS.forEach(({ id }) => {
        const viewport = engine.getViewport(id);
        if (viewport && viewport instanceof cornerstone.VolumeViewport) {
           viewport.setProperties({ invert: invert });
        }
     });
     engine.render();
  }, [invertEvent, invert]);


  return (
    <div className="grid size-full grid-cols-1 gap-1.5 md:grid-cols-[1.4fr_1fr] md:grid-rows-2">
      {VIEWPORTS.map(({ id, label, accent }, idx) => (
        <div
          key={id}
          className={cn(
            'relative min-h-0 min-w-0 overflow-hidden rounded-md border bg-black',
            idx === 0 && 'md:row-span-2'
          )}
          style={{ borderColor: `color-mix(in oklch, ${accent} 45%, transparent)` }}
        >
          <div
            className="absolute inset-0 size-full touch-none select-none outline-none"
            ref={(element) => {
              elementRefs.current[id] = element;
            }}
            onContextMenu={(event) => event.preventDefault()}
            aria-label={`${label} срез`}
          />
          <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-slate-200">
            <span className="size-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
