export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Parameters = { [key: string]: JsonValue };
export interface Amc extends Parameters {
  geometry: { [name: string]: Parameters };
}
export interface MoverMount {
  id: string;
  name: string;
  role: 'socket' | 'anchor';
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: [number, number, number];
  parent?: string;
  accepts: string[];
}
export interface MoverBundle {
  amc?: Amc;
  assetId?: string;
  transform?: Pick<MoverMount, 'position' | 'rotation' | 'scale'>;
  mounts: MoverMount[];
  attachments?: { id: string; version: string }[];
  assembly?: { socketId: string; id: string; version: string }[];
  dependencies?: { engine?: Record<string, Parameters>; airfoil?: Record<string, string> };
}
export interface MoverEntry {
  id: string;
  kind: 'vehicle' | 'engine' | 'airfoil';
  path: string;
  assetId: string;
}
export interface MoverDesign {
  id: string;
  name: string;
  revision: number;
  headRevision: number;
  bundle: MoverBundle;
}
export function componentType(g: Parameters) {
  return String(g.GeometryObjectType || (g.EngineModel ? 'GeometryEngine' : ''));
}

export const parameterOptions: Record<string, string[]> = {
  'Forward Shape': ['Ogive', 'Cone', 'Round', 'Blunt'],
  'Aft Shape': ['Ogive', 'Cone', 'Round', 'Blunt', 'BoatTail'],
  'Overall Shape': [
    'Rounded',
    'Half-Round-Right',
    'Half-Round-Left',
    'Half-Round-Top',
    'Half-Round-Bottom',
    'Flat-Sided',
    'Flat-Swept-Right',
    'Flat-Swept-Left',
  ],
  'Aft Section Shape': ['Blunt', 'Tapered'],
  'Symmetry Type': ['Single', 'Horizontal', 'Vertical', '+ Pattern', 'X Pattern'],
};

export const componentDefaults: Record<string, Parameters> = {
  GeometryLandingGear: {
    'Uncompressed Length': 5,
    'Strut Diam': 0.25,
    'Tire Diam': 1.5,
    'Tire Width': 0.6,
    'Max Angle': 90,
    Symmetrical: false,
  },
  GeometryBody: {
    Length: 10,
    Height: 2,
    Width: 2,
    'Forward Shape': 'Ogive',
    'Forward Shape Length': 2,
    'Aft Shape': 'Blunt',
    'Aft Shape Length': 0,
    'Aft Shape Diameter': 0,
    'Yaw Angle': 0,
    'Pitch Angle': 0,
    'Roll Angle': 0,
    Symmetrical: false,
  },
  GeometryFuselage: {
    Length: 20,
    Height: 3,
    Width: 3,
    'Forward Shape': 'Ogive',
    'Forward Shape Length': 4,
    'Aft Shape': 'Cone',
    'Aft Shape Length': 4,
    'Canopy Present': false,
    'Canopy Total Length': 5,
    'Canopy Forward Length': 2,
    'Canopy Aft Length': 2,
    'Canopy Width': 2,
    'Canopy Height': 1,
    'Canopy Ref-X': 3,
    'Canopy Ref-Y': 0,
    'Canopy Ref-Z': -1.5,
    'Yaw Angle': 0,
    'Pitch Angle': 0,
    'Roll Angle': 0,
    Symmetrical: false,
  },
  GeometrySurface: {
    Span: 4,
    'Root Chord': 3,
    'Tip Chord': 1,
    'Sweep Angle': 20,
    'Dihedral Angle': 0,
    'Incidence Angle': 0,
    'Thickness Ratio': 0.1,
    'Symmetry Type': 'Single',
    'Fin Ref Radius': 0,
    Airfoil: 'NACA-0012',
  },
  GeometryWing: {
    Span: 20,
    'Root Chord': 6,
    'Tip Chord': 2,
    'Sweep Angle': 20,
    'Dihedral Angle': 0,
    'Incidence Angle': 0,
    'Thickness Ratio': 0.1,
    'Symmetry Type': 'Horizontal',
    'Symmetry Cannot Be Changed': true,
    Airfoil: 'NACA-0012',
  },
  GeometryNacelle: {
    Length: 8,
    Height: 3,
    Width: 3,
    Thickness: 0.2,
    'Height (Inner)': 3,
    'Height (Outer)': 2,
    'Forward Sweep Length': 1,
    'Overall Shape': 'Rounded',
    'Aft Section Shape': 'Blunt',
    'Aft Section Length': 0,
    'Yaw Angle': 0,
    'Pitch Angle': 0,
    'Roll Angle': 0,
    Symmetrical: false,
  },
  GeometryDish: { Diameter: 5, Thickness: 0.5 },
  GeometrySpeedBrake: {
    Length: 2,
    Width: 1,
    'Roll Angle': 0,
    'Max Angle': 45,
    'Symmetry Type': 'Single',
  },
  GeometryEngine: {
    EngineModel: 'NOMINAL_LIQUID_RKT',
    EngineType: 'LiquidRocket',
    'Yaw Angle': 0,
    'Pitch Angle': 0,
    'Roll Angle': 0,
    Symmetrical: false,
  },
  GeometryPointMass: { Mass: 10 },
  GeometryMassProperties: { 'Empty Mass (Specified)': 100, 'Auto-Calculate Inertia': true },
  GeometryPropulsionData: {
    'Enable Fuel Tank': true,
    'Fuel Quantity (Max)': 100,
    'Fuel Quantity (Current)': 100,
  },
};
