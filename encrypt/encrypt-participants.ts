const fs = require('fs');
const CryptoJS = require('crypto-js');
import {encrypt} from './encrypt-config';

const password = encrypt.password;
const fileName = 'example.txt';
const names = fs.readFileSync(`./participants/${fileName}`, 'utf8').split('\n').filter(Boolean);
const encryptedNames = names.map((name: any) => CryptoJS.AES.encrypt(name, password).toString());

fs.writeFileSync(`../public/participants/${fileName}`, encryptedNames.join('\n'), 'utf8');
console.log('Namen wurden verschlüsselt gespeichert.');
