/** Every selectable part across the five digital twins, and which twin shows it. */
export type TwinView = 'smartcity' | 'power' | 'water' | 'transit' | 'hospital'

export const TWIN_VIEW_LABEL: Record<TwinView, string> = {
  smartcity: 'Smart City (integrated)',
  power: 'Power grid & substation',
  water: 'Water treatment',
  transit: 'Transit & rail',
  hospital: 'Trauma hospital',
}

const part = (view: TwinView, label: string) => ({ view, label })

export const PART_INFO: Record<string, { view: TwinView; label: string }> = {
  'sub-transformer': part('power', 'Power Transformer'),
  'sub-circuit-breaker': part('power', 'SF6 Circuit Breaker'),
  'sub-disconnect-switch': part('power', 'Disconnect Switch'),
  'sub-busbar-gantry': part('power', '33kV Busbar Gantry'),
  'sub-control-cabinet': part('power', 'Protection & RTU Cabinet'),
  'sub-radiators': part('power', 'Cooling Radiators'),
  'sub-bushings': part('power', 'HV Bushings'),
  'sub-lightning-arrester': part('power', 'Lightning Arresters'),
  'sub-grounding': part('power', 'Earthing Grid'),
  'water-intake': part('water', 'Raw Water Intake Wells'),
  'water-coagulation': part('water', 'Flash Coagulation & Flocculator'),
  'water-clarifiers': part('water', 'Sedimentation Clarifiers'),
  'water-filters': part('water', 'Rapid Gravity Sand Filters'),
  'water-chemical': part('water', 'Chlorination Dosing Silos'),
  'water-booster-pumps': part('water', 'Treated Water Booster Pumps'),
  'water-reservoir': part('water', 'Potable Storage Reservoir'),
  'hosp-tower': part('hospital', 'Inpatient & Surgical Tower'),
  'hosp-helipad': part('hospital', 'Rooftop Trauma Helipad'),
  'hosp-trauma': part('hospital', 'Emergency Trauma & Triage'),
  'hosp-oxygen': part('hospital', 'Cryogenic Liquid O2 Farm'),
  'hosp-generator': part('hospital', 'Emergency Generator Plant'),
  'transit-terminal': part('transit', 'Central Passenger Concourse'),
  'transit-viaduct': part('transit', 'Elevated Sky-Train Viaduct'),
  'transit-skytrain': part('transit', 'Driverless Sky-Train Trainset'),
  'transit-ev-depot': part('transit', 'Electric Bus Rapid Depot'),
  'transit-dispatch': part('transit', 'SCADA Rail Dispatch Tower'),
  'city-substation': part('smartcity', 'Bulk Power & Substation Campus'),
  'city-hospital': part('smartcity', 'Regional Trauma Hospital'),
  'city-ioc': part('smartcity', 'IOC Command Skyscraper'),
  'city-edge-dc': part('smartcity', '5G Edge Compute & Mast'),
  'city-water': part('smartcity', 'Water Purification Works'),
  'city-reservoir': part('smartcity', 'Elevated Water Reservoir'),
  'city-transit-rail': part('smartcity', 'Sky-Train Rail Viaduct'),
  'city-ev-hub': part('smartcity', 'Smart EV Transit Depot'),
  'city-bess': part('smartcity', 'Municipal BESS Storage'),
  'city-solar': part('smartcity', 'Solar PV Canopy'),
  'city-utility-trench': part('smartcity', 'Inter-Island Sky-Bridges'),
}

export const partLabel = (id: string) => PART_INFO[id]?.label ?? id
export const viewOfPart = (id: string): TwinView | undefined => PART_INFO[id]?.view
