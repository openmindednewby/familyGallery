import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, filter, interval, map, skip, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-folder',
  templateUrl: './folder.page.html',
  styleUrls: ['./folder.page.scss'],
})
export class FolderPage implements OnInit, OnDestroy {
  public isLoopEnabled = true;
  public isFullScreen = false;
  public currentImageUrl = '';
  public switchImageDelayMs = 5000;

  private startPreviewSubject = new BehaviorSubject<boolean>(false);
  public startPreview$ = this.startPreviewSubject.asObservable();

  private loadedImageFileSubject = new Subject<File>;
  public loadedImageFile$ = this.loadedImageFileSubject.asObservable();

  private subscription = new Subscription()
  private intervalSubscription = new Subscription()
  private currentImageIndex = 0;
  private directoryHandle!: FileSystemDirectoryHandle;
  private directoryFiles: { key: any, value: any }[] = [];//https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle

  public ngOnInit(): void {
    this.subscription.add(this.startPreview$.pipe(
      filter(value => value),
      map(() => this.startPresentation()),
      tap(() => this.switchFullScreen())
    ).subscribe());

    this.subscription.add(this.loadedImageFile$.pipe(
      switchMap(async file => { return await this.loadImage(file); })
    ).subscribe());
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.intervalSubscription?.unsubscribe();
  }

  public async choseDirectory(): Promise<void> {
    // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle
    this.directoryHandle = await (window as any).showDirectoryPicker();

    for await (const [key, value] of (this.directoryHandle as any).entries()) {
      this.directoryFiles.push({ key, value });
    };

    this.startPreviewSubject.next(true);
  }

  public startPresentation(): void {
    this.currentImageIndex = 0;

    this.loadImagesOneByOne();
    this.intervalSubscription?.unsubscribe();
    this.intervalSubscription = interval(this.switchImageDelayMs).pipe(skip(1), switchMap(_ => this.loadImagesOneByOne())).subscribe();
  }

  public switchFullScreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.isFullScreen = true;
    } else {
      this.exitFullScreen();
    }
  }

  private exitFullScreen(): void {
    document.exitFullscreen();
    this.isFullScreen = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  public onKeydownHandler(_: KeyboardEvent) {
    if(this.isFullScreen) {
      this.exitFullScreen();
    }
  }

  private async loadImagesOneByOne(): Promise<void> {
    if (!this.directoryFiles.length) {
      return;
    }

    if (this.directoryFiles.length < 1) {
      return;
    }

    if (this.currentImageIndex + 1 === this.directoryFiles.length) {
      if (!this.isLoopEnabled) {
        return;
      }

      this.currentImageIndex = 0;
    }

    const fileHandle = await this.directoryHandle.getFileHandle(this.directoryFiles[this.currentImageIndex].key, { create: false });
    const fileHandle2 = await this.directoryFiles[this.currentImageIndex].value;
    //fileHandle2.
    this.loadedImageFileSubject.next(await fileHandle.getFile().then(file => file));
  }

  private async loadImage(file: File) {
    await this.readAndApplyImage(file);
    this.currentImageIndex++;
  }

  private async readAndApplyImage(image: File): Promise<void> {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      if ((typeof reader.result) === 'string') {
        this.currentImageUrl = ev.target?.result as string;
      }
    };
    reader.readAsDataURL(image);
  }
}
