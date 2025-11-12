import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import {encrypt} from '../../../encrypt/encrypt-config';

@Injectable({
  providedIn: 'root'
})
export class Encryption {
  decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, encrypt.password);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}
