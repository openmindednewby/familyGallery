import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Subscription, filter, interval, map, skip, switchMap } from 'rxjs';

@Component({
  selector: 'app-folder',
  templateUrl: './folder.page.html',
  styleUrls: ['./folder.page.scss'],
})
export class FolderPage implements OnInit, OnDestroy {
  public isLoopEnabled = true;
  public isFullScreen = false;
  public files: File[] = [];
  public currentImageUrl = '';
  public switchImageDelayMs = 5000;

  private startPreviewSubject = new BehaviorSubject<boolean>(false);
  public startPreview$ = this.startPreviewSubject.asObservable();

  private subscription = new Subscription()
  private intervalSubscription = new Subscription()
  private currentImageIndex = 0;

  public ngOnInit(): void {
    this.subscription.add(this.startPreview$.pipe(
      filter(value => value),
      map(() => this.startPresentation())
    ).subscribe());
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.intervalSubscription?.unsubscribe();
  }

  public chooseFile(event: any) {
    if (event.target.files && event.target.files[0]) {
      this.currentImageIndex = 0;
      this.files = Array.from(event.target.files);
      this.startPreviewSubject.next(true);
    }
  }

  public startPresentation(): void {
    this.currentImageIndex = 0;

    this.loadImagesOneByOne();
    this.intervalSubscription?.unsubscribe();
    this.intervalSubscription = interval(this.switchImageDelayMs).pipe(skip(1),switchMap(_ => this.loadImagesOneByOne())).subscribe();
  }

  public switchFullScreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.isFullScreen = true;
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      this.isFullScreen = false;
    }
  }

  private async loadImagesOneByOne(): Promise<void> {
    if(this.files.length < 1) {
      return;
    }

    if(this.currentImageIndex + 1 === this.files.length) {
      if(!this.isLoopEnabled) {
        return;
      }

      this.currentImageIndex = 0;
    }

    const file = this.files[this.currentImageIndex];
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
