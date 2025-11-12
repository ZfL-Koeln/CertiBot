import {Component, Inject} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from "@angular/material/dialog";
import {MatInputModule} from "@angular/material/input";
import {DialogData} from "../certificate/certificate";

@Component({
  selector: 'app-dialog',
  imports: [
    MatButtonModule,
    MatDialogActions,
    MatDialogTitle,
    MatDialogContent,
    FormsModule,
    MatInputModule
  ],
  templateUrl: './error-dialog.html',
  styleUrl: './error-dialog.scss'
})
export class ErrorDialog {
  constructor(public dialogRef: MatDialogRef<ErrorDialog>,
              @Inject(MAT_DIALOG_DATA) public data: DialogData) {
  }

  submit() {
    this.dialogRef.close(this.data.name);
  }
}
