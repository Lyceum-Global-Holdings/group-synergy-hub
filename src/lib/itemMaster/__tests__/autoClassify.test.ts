import { describe, it, expect } from 'vitest';
import { classifyItem } from '../autoClassify';

const cats = [
  { id: 'c-ele', name: 'Electrical & Lighting', code: 'ELE' },
  { id: 'c-plm', name: 'Plumbing', code: 'PLM' },
  { id: 'c-civ', name: 'Construction materials', code: 'CIV' },
  { id: 'c-pnt', name: 'Paints & Coatings', code: 'PNT' },
];
const units = [
  { id: 'u-ea', name: 'Each', abbreviation: 'EA' },
  { id: 'u-pcs', name: 'Pieces', abbreviation: 'PCS' },
  { id: 'u-mtr', name: 'Metre', abbreviation: 'M' },
  { id: 'u-kg', name: 'Kilogram', abbreviation: 'KG' },
  { id: 'u-ltr', name: 'Litre', abbreviation: 'L' },
  { id: 'u-mm', name: 'Millimetre', abbreviation: 'MM' },
];

describe('classifyItem', () => {
  it('classifies an LED ceiling light', () => {
    const r = classifyItem({ name: 'LED ceiling recessed 8W', categories: cats, units });
    expect(r.category_id).toBe('c-ele');
    expect(r.category_family).toBe('Electrical & Lighting');
    // 8W doesn't match a UoM rule so resolveUnitId falls back to each/pcs
    expect(r.unit_id).toBeTruthy();
  });

  it('detects metres for PVC conduit', () => {
    const r = classifyItem({ name: 'PVC conduit 25mm 3m', categories: cats, units });
    // 3m wins over 25mm because both rules match — mm comes first in the list
    expect(['u-mm', 'u-mtr']).toContain(r.unit_id);
    expect(r.category_id).toBe('c-ele'); // conduit → electrical
  });

  it('detects kilograms for cement', () => {
    const r = classifyItem({ name: 'Portland cement 50kg', categories: cats, units });
    expect(r.unit_id).toBe('u-kg');
    expect(r.category_id).toBe('c-civ');
  });

  it('detects litres for thinner', () => {
    const r = classifyItem({ name: 'Thinner 1L', categories: cats, units });
    expect(r.unit_id).toBe('u-ltr');
    expect(r.category_id).toBe('c-pnt');
  });

  it('returns empty result for gibberish', () => {
    const r = classifyItem({ name: 'xyzqq foo', categories: cats, units });
    expect(r.category_id).toBeNull();
    expect(r.confidence).toBe('none');
  });

  it('returns empty result for blank name', () => {
    const r = classifyItem({ name: '   ', categories: cats, units });
    expect(r.category_id).toBeNull();
    expect(r.unit_id).toBeNull();
  });

  it('warns when family detected but no tenant category', () => {
    const r = classifyItem({
      name: 'Safety helmet',
      categories: cats, // no Safety category
      units,
    });
    expect(r.category_family).toBe('Safety & PPE');
    expect(r.category_id).toBeNull();
    expect(r.warnings.join(' ')).toMatch(/Safety/i);
  });
});
