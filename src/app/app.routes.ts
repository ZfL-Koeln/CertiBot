import { Routes } from '@angular/router';
import {Certificate} from './components/certificate/certificate';

export const routes: Routes = [
  {
    path: ':id',
    component: Certificate
  }
];
