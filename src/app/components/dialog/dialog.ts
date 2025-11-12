import {Component, Inject} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialogActions, MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from "@angular/material/dialog";
import {MatFormField, MatLabel} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {DialogData} from "../certificate/certificate";

@Component({
  selector: 'app-dialog',
  imports: [
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    MatLabel,
    MatFormField,
    FormsModule,
    MatInputModule
  ],
  templateUrl: './dialog.html',
  styleUrl: './dialog.scss'
})
export class Dialog {
  constructor(public dialogRef: MatDialogRef<Dialog>,
              @Inject(MAT_DIALOG_DATA) public data: DialogData) {
  }

  submit() {
    this.dialogRef.close(this.data.name);
  }
}
