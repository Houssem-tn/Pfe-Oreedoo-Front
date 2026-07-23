import { FieldExecutionComponent } from './field-execution.component';

/**
 * Focused unit tests for the Résiliation plain-attachment logic. The component has a large
 * dependency graph, so we exercise the self-contained attachment methods on a bare prototype
 * instance (no Angular DI) — `render`/`showBanner` are stubbed. This covers:
 *  - multiple files accepted (together or one by one)
 *  - adding new files preserves earlier selections
 *  - removing one file keeps the others (red-X behavior)
 *  - unsupported types are rejected, and OCR is never invoked (no OCR service touched here)
 */
describe('FieldExecutionComponent — Résiliation attachments', () => {
  let comp: any;
  let banners: string[];

  beforeEach(() => {
    comp = Object.create(FieldExecutionComponent.prototype);
    comp.resAttachments = [];
    banners = [];
    comp.render = () => {};
    comp.showBanner = (msg: string) => banners.push(msg);
  });

  function fileInput(files: File[]): HTMLInputElement {
    return { files, value: 'preset' } as unknown as HTMLInputElement;
  }

  function img(name: string): File {
    return new File(['x'], name, { type: 'image/png' });
  }

  it('accepts multiple files selected together', () => {
    comp.addResAttachments(fileInput([img('a.png'), img('b.png')]));
    expect(comp.resAttachments.length).toBe(2);
    expect(comp.resAttachments.map((a: any) => a.file.name)).toEqual(['a.png', 'b.png']);
  });

  it('preserves earlier selections when more files are added one by one', () => {
    comp.addResAttachments(fileInput([img('a.png')]));
    comp.addResAttachments(fileInput([img('b.png')]));
    comp.addResAttachments(fileInput([img('c.png')]));
    expect(comp.resAttachments.map((a: any) => a.file.name)).toEqual(['a.png', 'b.png', 'c.png']);
  });

  it('removes only the selected file and keeps the others', () => {
    comp.addResAttachments(fileInput([img('a.png'), img('b.png'), img('c.png')]));
    comp.removeResAttachment(1); // remove b.png
    expect(comp.resAttachments.map((a: any) => a.file.name)).toEqual(['a.png', 'c.png']);
  });

  it('accepts PDF and images but rejects unsupported types', () => {
    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const exe = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' });
    comp.addResAttachments(fileInput([pdf, exe]));
    expect(comp.resAttachments.map((a: any) => a.file.name)).toEqual(['doc.pdf']);
    expect(banners.length).toBe(1); // rejection warning for the .exe
  });

  it('skips exact duplicates (same name + size)', () => {
    comp.addResAttachments(fileInput([img('a.png')]));
    comp.addResAttachments(fileInput([img('a.png')]));
    expect(comp.resAttachments.length).toBe(1);
  });

  it('flags images vs non-images for the icon', () => {
    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    comp.addResAttachments(fileInput([img('a.png'), pdf]));
    expect(comp.resAttachments[0].isImage).toBe(true);
    expect(comp.resAttachments[1].isImage).toBe(false);
  });
});
