import {
  Injectable,
  ElementRef,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';

/**
 * Manages map viewport: pan, zoom, pointer handling, and transform math
 */
@Injectable({ providedIn: 'root' })
export class MapViewportService {
  readonly dragStartThresholdPx = 2;

  readonly minZoom = 1;
  readonly maxZoom = 15;
  readonly zoomStep = 0.2;
  readonly ctrlZoomMultiplier = 3;
  readonly defaultZoom = 2;
  readonly mapWidth = 1200;
  readonly mapHeight = 600;

  readonly zoom: WritableSignal<number> = signal(this.defaultZoom);
  readonly panX: WritableSignal<number> = signal(0);
  readonly panY: WritableSignal<number> = signal(0);
  readonly isDragging: WritableSignal<boolean> = signal(false);

  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private movedDuringActivePointer = false;
  private suppressNextCountryClick = false;
  private mapCanvasElement: HTMLDivElement | null = null;

  /**
   * Initialize viewport with map canvas element
   */
  setMapCanvas(target: ElementRef<HTMLDivElement>): void {
    this.mapCanvasElement = target.nativeElement;
  }

  /**
   * Zoom in by one step
   */
  zoomIn(): void {
    this.setZoom(this.zoom() + this.zoomStep);
  }

  /**
   * Zoom out by one step
   */
  zoomOut(): void {
    this.setZoom(this.zoom() - this.zoomStep);
  }

  /**
   * Reset view to default zoom and pan
   */
  resetView(): void {
    this.zoom.set(this.defaultZoom);
    this.panX.set(0);
    this.panY.set(0);
  }

  /**
   * Handle pointer down for drag start
   */
  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;

    this.activePointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.movedDuringActivePointer = false;
    this.isDragging.set(true);
    event.preventDefault();
  }

  /**
   * Handle pointer move for dragging
   */
  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging() || this.activePointerId !== event.pointerId) return;

    const dx = event.clientX - this.lastPointerX;
    const dy = event.clientY - this.lastPointerY;

    if (
      Math.abs(dx) >= this.dragStartThresholdPx ||
      Math.abs(dy) >= this.dragStartThresholdPx
    )
      this.movedDuringActivePointer = true;

    const clampedPan = this.clampPan(this.panX() + dx, this.panY() + dy);
    this.panX.set(clampedPan.x);
    this.panY.set(clampedPan.y);

    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    event.preventDefault();
  }

  /**
   * Handle pointer up for drag end
   */
  onPointerUp(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) return;

    if (this.movedDuringActivePointer) this.suppressNextCountryClick = true;

    this.activePointerId = null;
    this.isDragging.set(false);
    this.movedDuringActivePointer = false;
  }

  consumeCountryClickSuppression(): boolean {
    const suppress = this.suppressNextCountryClick;
    this.suppressNextCountryClick = false;
    return suppress;
  }

  /**
   * Handle wheel zoom with position preservation
   */
  createWheelHandler(): (event: WheelEvent) => void {
    return (event: WheelEvent) => {
      event.preventDefault();

      if (!this.mapCanvasElement) return;

      // Get pointer position relative to canvas element
      const canvasRect = this.mapCanvasElement.getBoundingClientRect();
      const pointerX = event.clientX - canvasRect.left;
      const pointerY = event.clientY - canvasRect.top;

      // Canvas/SVG center (transform-origin is center center)
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;

      // Calculate which point in the original SVG space is under the cursor
      // Transform: translate(panX, panY) scale(zoom) with origin at center
      // Screen position = (svgPoint - center) * zoom + pan + center
      // Therefore: svgPoint = (screenPos - pan - center) / zoom + center
      const oldZoom = this.zoom();
      const oldPanX = this.panX();
      const oldPanY = this.panY();
      const svgPointX = (pointerX - oldPanX - centerX) / oldZoom + centerX;
      const svgPointY = (pointerY - oldPanY - centerY) / oldZoom + centerY;

      // Apply zoom
      const zoomDirection = event.deltaY < 0 ? 1 : -1;
      const zoomAmount = event.ctrlKey
        ? this.zoomStep * this.ctrlZoomMultiplier
        : this.zoomStep;
      const newZoom = Math.min(
        this.maxZoom,
        Math.max(this.minZoom, oldZoom + zoomDirection * zoomAmount),
      );
      this.zoom.set(Number(newZoom.toFixed(2)));

      // Calculate new pan to keep svgPoint at the same screen position
      // pointerX = (svgPointX - centerX) * newZoom + newPanX + centerX
      // newPanX = pointerX - (svgPointX - centerX) * newZoom - centerX
      const newPanX = pointerX - (svgPointX - centerX) * newZoom - centerX;
      const newPanY = pointerY - (svgPointY - centerY) * newZoom - centerY;
      const clampedPan = this.clampPan(newPanX, newPanY, newZoom);
      this.panX.set(clampedPan.x);
      this.panY.set(clampedPan.y);
    };
  }

  /**
   * Clamp pan values to prevent over-panning
   */
  private clampPan(
    x: number,
    y: number,
    zoomValue = this.zoom(),
  ): { x: number; y: number } {
    if (!this.mapCanvasElement) {
      return { x, y };
    }

    const canvasRect = this.mapCanvasElement.getBoundingClientRect();
    const maxPanX = Math.max(
      0,
      (canvasRect.width * zoomValue - canvasRect.width) / 2,
    );
    const maxPanY = Math.max(
      0,
      (canvasRect.height * zoomValue - canvasRect.height) / 2,
    );

    return {
      x: Math.min(maxPanX, Math.max(-maxPanX, x)),
      y: Math.min(maxPanY, Math.max(-maxPanY, y)),
    };
  }

  /**
   * Set zoom with bounds and pan clamping
   */
  private setZoom(value: number): void {
    const next = Math.min(this.maxZoom, Math.max(this.minZoom, value));
    this.zoom.set(Number(next.toFixed(2)));

    const clampedPan = this.clampPan(this.panX(), this.panY(), next);
    this.panX.set(clampedPan.x);
    this.panY.set(clampedPan.y);
  }
}
