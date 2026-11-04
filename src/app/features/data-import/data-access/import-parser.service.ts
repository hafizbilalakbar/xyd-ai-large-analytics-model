import { Injectable, NgZone, inject } from '@angular/core';
import { signal } from '@angular/core';
import type {
  ImportProgress,
  PlaybackImportResult,
  TrainingImportResult,
  WorkerRequest,
  WorkerResponse,
} from './data-import.models';

@Injectable()
export class ImportParserService {
  private readonly ngZone = inject(NgZone);
  private worker: Worker | null = null;
  private messageHandler: ((response: WorkerResponse) => void) | null = null;

  readonly progress = signal<ImportProgress | null>(null);
  readonly isRunning = signal(false);

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./import-parser.worker', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.ngZone.run(() => {
          this.messageHandler?.(event.data);
        });
      };
    }
    return this.worker;
  }

  parsePlayback(files: File[], batchId: string): Promise<PlaybackImportResult> {
    return this.runWorker({ type: 'parsePlayback', files, batchId });
  }

  parseTraining(files: File[]): Promise<TrainingImportResult> {
    return this.runWorker({ type: 'parseTraining', files });
  }

  private runWorker<T extends PlaybackImportResult | TrainingImportResult>(
    request: WorkerRequest,
  ): Promise<T> {
    this.isRunning.set(true);
    this.progress.set(null);
    return new Promise<T>((resolve, reject) => {
      this.messageHandler = (response) => {
        switch (response.type) {
          case 'progress':
            this.progress.set(response.progress);
            break;
          case 'playbackResult':
          case 'trainingResult':
            this.isRunning.set(false);
            this.progress.set(null);
            resolve(response.result as T);
            break;
          case 'error':
            this.isRunning.set(false);
            this.progress.set(null);
            reject(new Error(response.message));
            break;
          case 'cancelled':
            this.isRunning.set(false);
            this.progress.set(null);
            reject(new Error('cancelled'));
            break;
        }
      };
      this.getWorker().postMessage(request);
    });
  }

  cancel(): void {
    if (this.worker && this.isRunning()) {
      this.worker.postMessage({ type: 'cancel' } as WorkerRequest);
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
