export interface Note { midi: number; spelling: string }
export interface Diagram {
  label: string;
  notes: Note[];
  lh: Note[];
  rh: Note[];
  emphasize: Note[];
}
export interface RenderRequest {
  title: string; subtitle: string; from: number; to: number;
  labels: boolean; diagrams: Diagram[];
}
