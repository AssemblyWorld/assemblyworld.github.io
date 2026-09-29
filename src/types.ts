export type Pose = [number, number, number, number, number, number, number];
export interface Variant {
  id: string;
  label: string;
  url: string;
  sha256: string;
  runId: string;
  PA: number;
  SR: number;
  SCD: number;
  episodeSHA256: string;
  calls: number;
}
export interface Case {
  id: string;
  title: string;
  dataset: string;
  domain: string;
  reference: string;
  sampleId: string;
  parts: number;
  revision: string;
  source: string;
  publish: boolean;
  licenseStatus: string;
  initial: string;
  initialSHA256: string;
  manual: string;
  thumbnail: string;
  variants: Variant[];
}
export interface Call {
  index: number;
  name: string;
  arguments: Record<string, unknown>;
  state_index: number;
  status: string;
  timestamp: string;
}
export interface Run {
  version: number;
  geometry: { url: string; sha256: string };
  parts: {
    id: string;
    name: string;
    sourceId: string;
    positions: number[] | Float32Array;
    indices: number[] | Uint32Array;
    positionOffset: number;
    positionCount: number;
    indexOffset: number;
    indexCount: number;
  }[];
  states: Record<string, Pose[]>;
  calls: Call[];
  groundTruth: Pose[];
  finalState: number;
}
export type ViewMode = "trajectory" | "initial" | "final" | "truth" | "overlay";
