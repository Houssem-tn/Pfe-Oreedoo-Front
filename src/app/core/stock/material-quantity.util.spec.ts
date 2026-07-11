import {
  normalizeMaterialUnit,
  materialUnitShort,
  materialUnitLabel,
  formatMaterialQuantity,
  groupMaterialQuantities,
  formatMaterialGroup,
  formatMaterialGroups,
} from './material-quantity.util';

describe('material-quantity.util', () => {
  describe('normalizeMaterialUnit', () => {
    it('should normalize different piece spellings to PIECES', () => {
      expect(normalizeMaterialUnit('PCS')).toBe('PIECES');
      expect(normalizeMaterialUnit('piece')).toBe('PIECES');
      expect(normalizeMaterialUnit('pc')).toBe('PIECES');
    });

    it('should normalize different meter spellings to METERS', () => {
      expect(normalizeMaterialUnit('m')).toBe('METERS');
      expect(normalizeMaterialUnit('METER')).toBe('METERS');
      expect(normalizeMaterialUnit('meters')).toBe('METERS');
    });

    it('should fall back to UNITS for blank/undefined input', () => {
      expect(normalizeMaterialUnit(undefined)).toBe('UNITS');
      expect(normalizeMaterialUnit('   ')).toBe('UNITS');
    });

    it('should uppercase and pass through unrecognized units', () => {
      expect(normalizeMaterialUnit('kg')).toBe('KG');
    });
  });

  describe('materialUnitShort / materialUnitLabel', () => {
    it('should render short and label forms for pieces and meters', () => {
      expect(materialUnitShort('PCS')).toBe('pcs');
      expect(materialUnitLabel('PCS')).toBe('Pieces');
      expect(materialUnitShort('m')).toBe('m');
      expect(materialUnitLabel('m')).toBe('Meters');
    });
  });

  describe('formatMaterialQuantity', () => {
    it('should format an integer quantity without decimals', () => {
      expect(formatMaterialQuantity(6, 'PCS')).toBe('6 pcs');
    });

    it('should format a fractional quantity with up to 2 decimals', () => {
      expect(formatMaterialQuantity(85.5, 'm')).toBe('85.5 m');
    });
  });

  describe('groupMaterialQuantities — piece/meter aggregation', () => {
    interface Row {
      equipmentId: string;
      equipmentName: string;
      unit: string;
      qty: number;
    }

    const config = {
      quantity: (r: Row) => r.qty,
      equipmentId: (r: Row) => r.equipmentId,
      equipmentName: (r: Row) => r.equipmentName,
      unit: (r: Row) => r.unit,
    };

    it('should aggregate different piece spellings for the same equipment into one bucket', () => {
      const rows: Row[] = [
        { equipmentId: 'eq-1', equipmentName: 'ONT Box', unit: 'PCS', qty: 2 },
        { equipmentId: 'eq-1', equipmentName: 'ONT Box', unit: 'Piece', qty: 3 },
        { equipmentId: 'eq-1', equipmentName: 'ONT Box', unit: 'pc', qty: 1 },
      ];

      const groups = groupMaterialQuantities(rows, config);

      expect(groups.length).toBe(1);
      expect(groups[0].unit).toBe('PIECES');
      expect(groups[0].quantity).toBe(6);
    });

    it('should never mix pieces and meters for the same equipment into one total', () => {
      const rows: Row[] = [
        { equipmentId: 'eq-3', equipmentName: 'Cable Drum', unit: 'PCS', qty: 4 },
        { equipmentId: 'eq-3', equipmentName: 'Cable Drum', unit: 'METERS', qty: 100 },
      ];

      const groups = groupMaterialQuantities(rows, config);

      expect(groups.length).toBe(2);
      const pieces = groups.find(g => g.unit === 'PIECES');
      const meters = groups.find(g => g.unit === 'METERS');
      expect(pieces?.quantity).toBe(4);
      expect(meters?.quantity).toBe(100);
    });

    it('should skip zero and non-finite quantities', () => {
      const rows: Row[] = [
        { equipmentId: 'eq-1', equipmentName: 'ONT Box', unit: 'PCS', qty: 0 },
        { equipmentId: 'eq-2', equipmentName: 'Bad Row', unit: 'PCS', qty: NaN },
      ];

      expect(groupMaterialQuantities(rows, config)).toEqual([]);
    });

    it('should group separately per equipment even with the same unit', () => {
      const rows: Row[] = [
        { equipmentId: 'eq-1', equipmentName: 'ONT Box', unit: 'PCS', qty: 2 },
        { equipmentId: 'eq-2', equipmentName: 'Router', unit: 'PCS', qty: 5 },
      ];

      expect(groupMaterialQuantities(rows, config).length).toBe(2);
    });
  });

  describe('formatMaterialGroup(s)', () => {
    it('should render a group with its equipment name by default', () => {
      const rendered = formatMaterialGroup({ equipmentId: 'eq-1', equipmentName: 'ONT Box', unit: 'PIECES', quantity: 5 });
      expect(rendered).toBe('5 pcs ONT Box');
    });

    it('should join multiple groups with the default separator', () => {
      const rendered = formatMaterialGroups([
        { equipmentId: 'eq-1', equipmentName: 'Fiber Cable', unit: 'METERS', quantity: 120 },
        { equipmentId: 'eq-2', equipmentName: 'ONT Box', unit: 'PIECES', quantity: 5 },
      ]);
      expect(rendered).toBe('120 m Fiber Cable / 5 pcs ONT Box');
    });

    it('should return the empty label when there are no groups', () => {
      expect(formatMaterialGroups([], { emptyLabel: 'No material' })).toBe('No material');
    });
  });
});
