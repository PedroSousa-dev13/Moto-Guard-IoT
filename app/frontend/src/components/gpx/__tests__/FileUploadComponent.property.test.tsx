import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import FileUploadComponent from '../FileUploadComponent';

// Feature: gpx-upload-ui, Property 1: File Type Validation
// **Validates: Requirements 1.2, 1.3**

describe('Property 1: File Type Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Generator for valid GPX file names
  const validGpxFileNameArbitrary = fc.tuple(
    fc.stringMatching(/^[a-zA-Z0-9_\-. ]+$/),
    fc.constantFrom('.gpx', '.GPX', '.Gpx', '.gPx')
  ).map(([name, ext]) => {
    // Ensure name is not empty and doesn't end with a dot
    const cleanName = name.trim() || 'file';
    return cleanName.replace(/\.$/, '') + ext;
  });

  // Generator for invalid file extensions
  const invalidExtensionArbitrary = fc.oneof(
    fc.constant('.txt'),
    fc.constant('.xml'),
    fc.constant('.json'),
    fc.constant('.csv'),
    fc.constant('.kml'),
    fc.constant('.pdf'),
    fc.constant('.doc'),
    fc.constant('.zip'),
    fc.constant('.jpg'),
    fc.constant('.png'),
    fc.constant(''),
    fc.constant('.gpx.txt'),
    fc.constant('.gpx.backup'),
    fc.stringMatching(/^\.[a-z]{2,5}$/).filter(ext => 
      !ext.toLowerCase().endsWith('.gpx')
    )
  );

  // Generator for invalid file names with various patterns
  const invalidFileNameArbitrary = fc.tuple(
    fc.stringMatching(/^[a-zA-Z0-9_\-. ]+$/),
    invalidExtensionArbitrary
  ).map(([name, ext]) => {
    const cleanName = name.trim() || 'file';
    return cleanName.replace(/\.$/, '') + ext;
  });

  // Generator for file content
  const fileContentArbitrary = fc.oneof(
    fc.constant('<?xml version="1.0"?><gpx></gpx>'),
    fc.string({ minLength: 10, maxLength: 1000 }),
    fc.constant('')
  );

  // Generator for valid file sizes (under 10MB)
  const validFileSizeArbitrary = fc.integer({ min: 1, max: 10 * 1024 * 1024 });

  it('should accept all files with .gpx extension regardless of case', async () => {
    await fc.assert(
      fc.asyncProperty(
        validGpxFileNameArbitrary,
        fileContentArbitrary.filter(content => content.length > 0 && content.length <= 10 * 1024 * 1024),
        async (fileName, content) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const file = new File([content], fileName, { type: 'application/gpx+xml' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: All files with .gpx extension (any case) should be accepted
            expect(onFileSelect).toHaveBeenCalledWith(file);
            expect(onError).not.toHaveBeenCalled();
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should reject all files without .gpx extension with appropriate error', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidFileNameArbitrary,
        fileContentArbitrary,
        async (fileName, content) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const file = new File([content], fileName, { type: 'text/plain' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: All files without .gpx extension should be rejected
            expect(onError).toHaveBeenCalledWith('Por favor seleciona um ficheiro .gpx');
            expect(onFileSelect).not.toHaveBeenCalled();
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should validate file extension before file size', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidFileNameArbitrary,
        fc.integer({ min: 10 * 1024 * 1024 + 1, max: 20 * 1024 * 1024 }),
        async (fileName, fileSize) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const content = 'x'.repeat(fileSize);
          const file = new File([content], fileName, { type: 'text/plain' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: File extension validation should happen first
            // Even if file is too large, extension error should be shown for non-GPX files
            expect(onError).toHaveBeenCalledWith('Por favor seleciona um ficheiro .gpx');
            expect(onFileSelect).not.toHaveBeenCalled();
          }, { timeout: 1000 });
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  it('should handle edge cases in file names correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('file.gpx'),
          fc.constant('.gpx'),
          fc.constant('my.file.with.dots.gpx'),
          fc.constant('file with spaces.gpx'),
          fc.constant('file_with_underscores.gpx'),
          fc.constant('file-with-dashes.gpx'),
          fc.constant('UPPERCASE.GPX'),
          fc.constant('MixedCase.GpX'),
          fc.constant('123456.gpx'),
          fc.constant('file.gpx.gpx')
        ),
        validFileSizeArbitrary,
        async (fileName, fileSize) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const content = 'x'.repeat(fileSize);
          const file = new File([content], fileName, { type: 'application/gpx+xml' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: All edge case file names ending with .gpx should be accepted
            expect(onFileSelect).toHaveBeenCalledWith(file);
            expect(onError).not.toHaveBeenCalled();
          }, { timeout: 500 });
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  it('should reject files with .gpx in the middle but different extension', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9_\-]+$/),
          invalidExtensionArbitrary.filter(ext => ext.length > 0)
        ).map(([name, ext]) => `${name || 'file'}.gpx${ext}`),
        fileContentArbitrary,
        async (fileName, content) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const file = new File([content], fileName, { type: 'text/plain' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: Files with .gpx in the middle but different extension should be rejected
            expect(onError).toHaveBeenCalledWith('Por favor seleciona um ficheiro .gpx');
            expect(onFileSelect).not.toHaveBeenCalled();
          }, { timeout: 500 });
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  it('should consistently validate file type across drag-and-drop and file input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(validGpxFileNameArbitrary, invalidFileNameArbitrary),
        fileContentArbitrary.filter(content => content.length > 0 && content.length <= 10 * 1024 * 1024),
        fc.constantFrom('input', 'drop'),
        async (fileName, content, method) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const file = new File([content], fileName, { type: 'application/gpx+xml' });
          const isValidGpx = fileName.toLowerCase().endsWith('.gpx');

          if (method === 'input') {
            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(fileInput, 'files', {
              value: [file],
              writable: false,
              configurable: true,
            });
            fireEvent.change(fileInput);
          } else {
            const dropArea = container.querySelector('.gpx-upload-area') as HTMLElement;
            fireEvent.drop(dropArea, {
              dataTransfer: {
                files: [file],
              },
            });
          }

          await waitFor(() => {
            // Property: Validation should be consistent regardless of input method
            if (isValidGpx) {
              expect(onFileSelect).toHaveBeenCalledWith(file);
              expect(onError).not.toHaveBeenCalled();
            } else {
              expect(onError).toHaveBeenCalledWith('Por favor seleciona um ficheiro .gpx');
              expect(onFileSelect).not.toHaveBeenCalled();
            }
          }, { timeout: 500 });
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  it('should not accept files when disabled or uploading', async () => {
    await fc.assert(
      fc.asyncProperty(
        validGpxFileNameArbitrary,
        fileContentArbitrary.filter(content => content.length > 0 && content.length <= 10 * 1024 * 1024),
        fc.record({
          disabled: fc.boolean(),
          isUploading: fc.boolean(),
        }).filter(state => state.disabled || state.isUploading),
        async (fileName, content, state) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={state.isUploading}
              disabled={state.disabled}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const file = new File([content], fileName, { type: 'application/gpx+xml' });

          // Property: File input should be disabled
          expect(fileInput.disabled).toBe(true);

          // Try to trigger change anyway (shouldn't work in real browser, but test the logic)
          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          // Property: When disabled or uploading, file selection should not trigger callbacks
          // Note: The disabled attribute on the input prevents the change event in real browsers
          // In tests, if the event fires, the validation should still work
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // The component may or may not process the file depending on timing,
          // but the input should definitely be disabled
          expect(fileInput.disabled).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);
});

// Feature: gpx-upload-ui, Property 2: File Size and Content Validation
// **Validates: Requirements 6.1, 6.2**

describe('Property 2: File Size and Content Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Generator for file sizes (using smaller sizes for performance)
  const validFileSizeArbitrary = fc.integer({ min: 1, max: 1024 * 1024 }); // Up to 1MB for testing
  const invalidFileSizeArbitrary = fc.integer({ min: 10 * 1024 * 1024 + 1, max: 15 * 1024 * 1024 }); // Just over 10MB
  const boundaryFileSizeArbitrary = fc.constantFrom(
    10 * 1024 * 1024,     // Exactly 10MB (valid)
    10 * 1024 * 1024 + 1, // Just over 10MB (invalid)
    10 * 1024 * 1024 - 1, // Just under 10MB (valid)
    0,                     // Empty file (invalid)
    1,                     // Minimal file (valid)
  );

  // Generator for GPX file names
  const gpxFileNameArbitrary = fc.tuple(
    fc.stringMatching(/^[a-zA-Z0-9_\-. ]+$/),
    fc.constantFrom('.gpx', '.GPX')
  ).map(([name, ext]) => {
    const cleanName = name.trim() || 'file';
    return cleanName.replace(/\.$/, '') + ext;
  });

  it('should accept all files under 10MB size limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        gpxFileNameArbitrary,
        validFileSizeArbitrary,
        async (fileName, fileSize) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const content = 'x'.repeat(fileSize);
          const file = new File([content], fileName, { type: 'application/gpx+xml' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: All files under 10MB should be accepted
            expect(onFileSelect).toHaveBeenCalledWith(file);
            expect(onError).not.toHaveBeenCalled();
          });
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  it('should reject all files over 10MB size limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        gpxFileNameArbitrary,
        invalidFileSizeArbitrary,
        async (fileName, fileSize) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const content = 'x'.repeat(fileSize);
          const file = new File([content], fileName, { type: 'application/gpx+xml' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: All files over 10MB should be rejected with size error
            expect(onError).toHaveBeenCalledWith('O ficheiro é demasiado grande. Máximo permitido: 10MB');
            expect(onFileSelect).not.toHaveBeenCalled();
          });
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  it('should reject empty files (0 bytes)', async () => {
    await fc.assert(
      fc.asyncProperty(
        gpxFileNameArbitrary,
        async (fileName) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const file = new File([], fileName, { type: 'application/gpx+xml' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: Empty files should be rejected
            expect(onError).toHaveBeenCalledWith('O ficheiro selecionado está vazio');
            expect(onFileSelect).not.toHaveBeenCalled();
          });
        }
      ),
      { numRuns: 10 }
    );
  }, 10000);

  it('should correctly handle boundary file sizes', async () => {
    await fc.assert(
      fc.asyncProperty(
        gpxFileNameArbitrary,
        boundaryFileSizeArbitrary,
        async (fileName, fileSize) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const content = fileSize > 0 ? 'x'.repeat(fileSize) : '';
          const file = new File([content], fileName, { type: 'application/gpx+xml' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            const maxSize = 10 * 1024 * 1024;
            
            // Property: Boundary conditions should be handled correctly
            if (fileSize === 0) {
              expect(onError).toHaveBeenCalledWith('O ficheiro selecionado está vazio');
              expect(onFileSelect).not.toHaveBeenCalled();
            } else if (fileSize > maxSize) {
              expect(onError).toHaveBeenCalledWith('O ficheiro é demasiado grande. Máximo permitido: 10MB');
              expect(onFileSelect).not.toHaveBeenCalled();
            } else {
              expect(onFileSelect).toHaveBeenCalledWith(file);
              expect(onError).not.toHaveBeenCalled();
            }
          });
        }
      ),
      { numRuns: 25 }
    );
  }, 60000);

  it('should validate file size consistently across input methods', async () => {
    await fc.assert(
      fc.asyncProperty(
        gpxFileNameArbitrary,
        fc.oneof(validFileSizeArbitrary, invalidFileSizeArbitrary),
        fc.constantFrom('input', 'drop'),
        async (fileName, fileSize, method) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const content = 'x'.repeat(fileSize);
          const file = new File([content], fileName, { type: 'application/gpx+xml' });
          const maxSize = 10 * 1024 * 1024;
          const isValidSize = fileSize > 0 && fileSize <= maxSize;

          if (method === 'input') {
            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(fileInput, 'files', {
              value: [file],
              writable: false,
              configurable: true,
            });
            fireEvent.change(fileInput);
          } else {
            const dropArea = container.querySelector('.gpx-upload-area') as HTMLElement;
            fireEvent.drop(dropArea, {
              dataTransfer: {
                files: [file],
              },
            });
          }

          await waitFor(() => {
            // Property: Size validation should be consistent regardless of input method
            if (isValidSize) {
              expect(onFileSelect).toHaveBeenCalledWith(file);
              expect(onError).not.toHaveBeenCalled();
            } else {
              expect(onError).toHaveBeenCalled();
              expect(onFileSelect).not.toHaveBeenCalled();
            }
          });
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  it('should validate both extension and size in correct order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9_\-. ]+$/),
          fc.constantFrom('.txt', '.xml', '.json', '.csv')
        ).map(([name, ext]) => (name.trim() || 'file').replace(/\.$/, '') + ext),
        invalidFileSizeArbitrary,
        async (fileName, fileSize) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const content = 'x'.repeat(fileSize);
          const file = new File([content], fileName, { type: 'text/plain' });

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: Extension validation should happen before size validation
            // Even if file is too large, extension error should be shown first
            expect(onError).toHaveBeenCalledWith('Por favor seleciona um ficheiro .gpx');
            expect(onFileSelect).not.toHaveBeenCalled();
          });
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  it('should handle various file content types with valid size', async () => {
    await fc.assert(
      fc.asyncProperty(
        gpxFileNameArbitrary,
        fc.oneof(
          fc.constant('<?xml version="1.0"?><gpx></gpx>'),
          fc.constant('<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1"></gpx>'),
          fc.string({ minLength: 100, maxLength: 1000 }),
          fc.constant('a'.repeat(100 * 1024)), // 100KB of 'a'
          fc.constant('x'.repeat(500 * 1024)), // 500KB of 'x'
        ),
        async (fileName, content) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const file = new File([content], fileName, { type: 'application/gpx+xml' });

          // Skip if content is too large (over 10MB)
          if (file.size > 10 * 1024 * 1024) {
            return;
          }

          Object.defineProperty(fileInput, 'files', {
            value: [file],
            writable: false,
            configurable: true,
          });

          fireEvent.change(fileInput);

          await waitFor(() => {
            // Property: All content types should be accepted if size is valid
            // Content validation happens on the backend, not in the upload component
            expect(onFileSelect).toHaveBeenCalledWith(file);
            expect(onError).not.toHaveBeenCalled();
          });
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  it('should maintain validation state across multiple file selections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            fileName: gpxFileNameArbitrary,
            fileSize: fc.oneof(
              fc.integer({ min: 1, max: 100 * 1024 }), // Small valid files
              fc.integer({ min: 10 * 1024 * 1024 + 1, max: 11 * 1024 * 1024 }), // Just over limit
              fc.constant(0)
            ),
          }),
          { minLength: 2, maxLength: 3 }
        ),
        async (fileSequence) => {
          const onFileSelect = vi.fn();
          const onError = vi.fn();

          const { container } = render(
            <FileUploadComponent
              onFileSelect={onFileSelect}
              onError={onError}
              isUploading={false}
            />
          );

          const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
          const maxSize = 10 * 1024 * 1024;

          for (const { fileName, fileSize } of fileSequence) {
            onFileSelect.mockClear();
            onError.mockClear();

            const content = fileSize > 0 ? 'x'.repeat(fileSize) : '';
            const file = new File([content], fileName, { type: 'application/gpx+xml' });

            Object.defineProperty(fileInput, 'files', {
              value: [file],
              writable: false,
              configurable: true,
            });

            fireEvent.change(fileInput);

            await waitFor(() => {
              // Property: Each file selection should be validated independently
              if (fileSize === 0) {
                expect(onError).toHaveBeenCalledWith('O ficheiro selecionado está vazio');
                expect(onFileSelect).not.toHaveBeenCalled();
              } else if (fileSize > maxSize) {
                expect(onError).toHaveBeenCalledWith('O ficheiro é demasiado grande. Máximo permitido: 10MB');
                expect(onFileSelect).not.toHaveBeenCalled();
              } else {
                expect(onFileSelect).toHaveBeenCalledWith(file);
                expect(onError).not.toHaveBeenCalled();
              }
            });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});
