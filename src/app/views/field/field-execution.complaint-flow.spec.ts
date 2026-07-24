import { CaseResponse } from '../../core/cases/models/case.model';
import { EquipmentLabelScanComponent } from '../../shared/equipment-label-scan/equipment-label-scan.component';
import { FieldCaseDetailComponent } from './field-case-detail.component';
import { FieldExecutionComponent } from './field-execution.component';
import { canFinishFieldWork, canUpdateFieldRdv } from './field-case-utils';

describe('FieldExecutionComponent - complaint workflow', () => {
  let comp: any;
  let queryStep: string | null;
  let lastBanner: string | null;

  beforeEach(() => {
    queryStep = null;
    lastBanner = null;
    comp = Object.create(FieldExecutionComponent.prototype);
    comp.authStore = { role: () => 'ROLE_TECH' };
    comp.route = {
      snapshot: {
        queryParamMap: {
          get: () => queryStep
        }
      }
    };
    comp.render = () => {};
    comp.showBanner = (message: string) => {
      lastBanner = message;
    };
    comp.itemProofs = [];
    comp.activeStep = 'rdv';
    comp.caseItem = complaintCase();
  });

  it('removes diagnosis from complaint steps and progress calculation', () => {
    expect(comp.steps.map((step: any) => step.key)).toEqual([
      'rdv',
      'stock',
      'recovery',
      'work',
      'metrics',
      'completion'
    ]);

    comp.activeStep = 'metrics';
    expect(comp.stepState(comp.steps[3])).toBe('completed');
    expect(comp.stepState(comp.steps[4])).toBe('active');
    expect(comp.stepState(comp.steps[5])).toBe('future');
  });

  it('rejects diagnosis deep links and keeps technician complaint work entry on stock', () => {
    queryStep = 'diagnosis';
    expect(comp['stepFromQuery']()).toBe('rdv');

    queryStep = 'work';
    expect(comp['stepFromQuery']()).toBe('stock');
  });

  it('lets complaint proceed to completion without equipment photos', () => {
    comp.caseItem = complaintCase();
    comp.activeStep = 'metrics';

    comp.proceedToCompletion();

    expect(comp.activeStep).toBe('completion');
    expect(lastBanner).toBeNull();
  });

  it('keeps activation equipment-photo validation unchanged', () => {
    comp.caseItem = activationCase();
    comp.activeStep = 'metrics';

    comp.proceedToCompletion();

    expect(comp.activeStep).toBe('metrics');
    expect(lastBanner).toContain('Add at least one equipment photo');
  });

  it('keeps activation steps unchanged', () => {
    comp.caseItem = activationCase();
    expect(comp.steps.map((step: any) => step.key)).toEqual([
      'rdv',
      'stock',
      'work',
      'metrics',
      'completion'
    ]);
  });

  it('keeps résiliation steps unchanged', () => {
    comp.caseItem = resiliationCase();
    expect(comp.steps.map((step: any) => step.key)).toEqual([
      'rdv',
      'attachments',
      'recovery',
      'work',
      'completion'
    ]);
  });
});

describe('FieldCaseDetailComponent - complaint diagnosis visibility', () => {
  let comp: any;

  beforeEach(() => {
    comp = Object.create(FieldCaseDetailComponent.prototype);
  });

  it('keeps historical complaint diagnosis readable', () => {
    expect(comp.showDiagnosis(complaintCase({
      diagnosis: {
        complaintCategory: 'EQUIPMENT',
        diagnosisComment: 'Historical diagnosis'
      }
    }))).toBeTrue();
  });

  it('hides empty complaint diagnosis blocks', () => {
    expect(comp.showDiagnosis(complaintCase({ diagnosis: {} }))).toBeFalse();
  });

  it('shows metrics for complaint but not for résiliation', () => {
    expect(comp.showMetrics(complaintCase())).toBeTrue();
    expect(comp.showMetrics(resiliationCase())).toBeFalse();
  });
});

describe('Complaint field helpers', () => {
  it('allows complaint RDV updates from RDV_SET', () => {
    expect(canUpdateFieldRdv(complaintCase({ status: 'RDV_SET' }))).toBeTrue();
  });

  it('allows complaint finish entry from RDV_SET', () => {
    expect(canFinishFieldWork(complaintCase({ status: 'RDV_SET' }))).toBeTrue();
  });
});

describe('EquipmentLabelScanComponent - responsive scanner styles', () => {
  it('keeps scanner content width-capped and stacked on narrow screens', () => {
    const styles = ((EquipmentLabelScanComponent as any).ɵcmp?.styles ?? []).join(' ');

    expect(styles).toContain('max-width: 100%');
    expect(styles).toContain('.label-scan__actions');
    expect(styles).toContain('grid-template-columns: 1fr');
  });
});

function complaintCase(overrides: Partial<CaseResponse> = {}): CaseResponse {
  return {
    id: 'plt-1',
    type: 'PLAINTE',
    status: 'ASSIGNED_TO_TECH',
    crmCase: 'CRM-1',
    dateCreationCrm: '2026-07-23T00:00:00Z',
    openingDateTimos: '2026-07-23T00:00:00Z',
    clientName: 'Complaint Client',
    clientPhone: '12345678',
    msisdn: '21612345678',
    localite: 'Tunis',
    delegation: 'Centre',
    gouvernorat: 'Tunis',
    caseModule: 'PLT',
    techId: 'tech-1',
    techEmail: 'tech@example.com',
    executorId: 'tech-1',
    executorRole: 'TECH',
    executionMode: 'TECH_EXECUTION',
    ...overrides
  } as CaseResponse;
}

function activationCase(overrides: Partial<CaseResponse> = {}): CaseResponse {
  return {
    ...complaintCase({
      id: 'act-1',
      type: 'ACTIVATION',
      status: 'ASSIGNED_TO_TECH',
      caseModule: null
    }),
    ...overrides
  } as CaseResponse;
}

function resiliationCase(overrides: Partial<CaseResponse> = {}): CaseResponse {
  return {
    ...complaintCase({
      id: 'res-1',
      source: 'RES_TODO_IMPORT',
      caseModule: 'RES'
    }),
    ...overrides
  } as CaseResponse;
}
