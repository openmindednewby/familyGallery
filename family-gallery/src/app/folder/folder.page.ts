import { Component } from '@angular/core';

@Component({
  selector: 'app-folder',
  templateUrl: './folder.page.html',
  styleUrls: ['./folder.page.scss'],
})
export class FolderPage {

  public files: File[] = [];
  public currentImageUrl = '';

  public chooseFile(event: any) {
    console.log(event);
    if (event.target.files && event.target.files[0]) {
      this.files = Array.from(event.target.files);
    }
    this.startPreview();
  }

  public startPreview() {
    this.files.forEach((image, index) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if ((typeof reader.result) === 'string') {
          this.currentImageUrl = ev.target?.result as string;
        }
      };
      reader.readAsDataURL(image);
    });
  }
}
