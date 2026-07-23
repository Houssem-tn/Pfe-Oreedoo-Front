import { CaseResponse, caseSupportsMetrics, isResiliationCase } from './case.model';

/**
 * The metrics section must be shown for Activation AND Complaint, and hidden for Résiliation
 * (RES is a PLAINTE case discriminated by module/source). These pure helpers gate every
 * case-detail view consistently.
 */
describe('case metrics visibility helpers', () => {
  const base = { id: 'x' } as unknown as CaseResponse;

  function make(partial: Partial<CaseResponse>): CaseResponse {
    return { ...base, ...partial } as CaseResponse;
  }

  it('shows metrics for Activation', () => {
    expect(caseSupportsMetrics(make({ type: 'ACTIVATION' }))).toBe(true);
    expect(isResiliationCase(make({ type: 'ACTIVATION' }))).toBe(false);
  });

  it('shows metrics for Complaint (PLAINTE, non-RES)', () => {
    expect(caseSupportsMetrics(make({ type: 'PLAINTE' }))).toBe(true);
    expect(caseSupportsMetrics(make({ type: 'PLAINTE', caseModule: 'PLT' }))).toBe(true);
  });

  it('hides metrics for Résiliation by caseModule', () => {
    const res = make({ type: 'PLAINTE', caseModule: 'RES' });
    expect(isResiliationCase(res)).toBe(true);
    expect(caseSupportsMetrics(res)).toBe(false);
  });

  it('hides metrics for Résiliation by import source', () => {
    const res = make({ type: 'PLAINTE', source: 'RES_TODO_IMPORT' });
    expect(isResiliationCase(res)).toBe(true);
    expect(caseSupportsMetrics(res)).toBe(false);
  });

  it('is null-safe', () => {
    expect(caseSupportsMetrics(null)).toBe(false);
    expect(caseSupportsMetrics(undefined)).toBe(false);
    expect(isResiliationCase(null)).toBe(false);
  });
});
