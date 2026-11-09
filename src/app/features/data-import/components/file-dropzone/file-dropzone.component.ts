import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-file-dropzone',
  standalone: true,
  templateUrl: './file-dropzone.component.html',
  styleUrl: './file-dropzone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileDropzoneComponent {
  readonly icon = input<'monitor' | 'document'>('monitor');
  readonly label = input.required<string>();
  readonly accept = input<string>('');
  readonly format = input<string>('');
  readonly multiple = input(false);

  readonly fileSelect = output<File[]>();

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.fileSelect.emit(Array.from(files));
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      document.getElementById(this.inputId())?.click();
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this.fileSelect.emit(Array.from(files));
    }
    input.value = '';
  }

  private inputId(): string {
    return 'file-dropzone-input';
  }
}
