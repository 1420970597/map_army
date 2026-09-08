export interface MapCommandContext {
  copy(): boolean;
  paste(): boolean;
  zoomBy(delta: number): boolean;
  panBy(x: number, y: number): boolean;
  resetNorth(): boolean;
  toggleFullscreen(): boolean;
  confirm(): boolean;
  cancelDraw(): boolean;
}

let currentContext: MapCommandContext | null = null;

export function getMapCommandContext(): MapCommandContext | null {
  return currentContext;
}

export function registerMapCommandContext(context: MapCommandContext): () => void {
  currentContext = context;
  return () => {
    if (currentContext === context) currentContext = null;
  };
}
