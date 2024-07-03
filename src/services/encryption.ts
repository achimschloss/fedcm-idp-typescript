import CryptoJS from 'crypto-js';

// Dummy for prototyping
export const secretKey = 'your-very-secure-key'; 

// Encrypt user data
export const encryptData = (data: any) => {
    const jsonData = JSON.stringify(data);
    const ciphertext = CryptoJS.AES.encrypt(jsonData, secretKey).toString();
    return ciphertext;
};
  
  // Decrypt user data
export const decryptData = (ciphertext: string) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedData);
};