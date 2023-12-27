import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, filter, map } from 'rxjs';

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

  public ngOnInit(): void {
    this.subscription.add(this.startPreview$.pipe(
      filter(value => value),
      map(() => this.loadImages())
    ).subscribe());
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  public chooseFile(event: any) {
    if (event.target.files && event.target.files[0]) {
      this.files = Array.from(event.target.files);
    }

    this.startPreviewSubject.next(true);
  }

  public loadImages() {
    this.files.forEach((image, index) => {
      if(index ===0) {
        this.readAndApplyImage(image);
      } else {
        setTimeout(() => {
          this.readAndApplyImage(image);
          const shouldRestartLoop = this.isLoopEnabled && this.isLastItem(index);
          if(shouldRestartLoop) {
            this.startPreviewSubject.next(true);
          }
      }, this.switchImageDelayMs);
      }
    });
  }

  public switchFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.isFullScreen = true;
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      this.isFullScreen = false;
    }
  }

  private isLastItem(index: number) {
    if (this.files.length === (index + 1)) {
      return true;
    }
    return false;
  }

  private readAndApplyImage(image: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      if ((typeof reader.result) === 'string') {
        this.currentImageUrl = ev.target?.result as string;
      }
    };
    reader.readAsDataURL(image);
  }
}
