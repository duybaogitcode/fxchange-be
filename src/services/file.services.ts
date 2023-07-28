import crypto from 'crypto';
import sharp from 'sharp';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';

import EnvVars from '@src/constants/EnvVars';
import { app } from '@src/libs/firebase';
import { rollbar } from '@src/server';

export class FileService {
  private storage: any;

  public constructor() {
    this.storage = app.storage();
  }

  public async uploadFileToFirebase(file: File, path: string) {
    try {
      const bucketName = process.env.FIREBASE_BUCKET;
      console.log(
        '🚀 ~ file: file.services.ts:19 ~ FileService ~ uploadFileToFirebase ~ bucketName:',
        bucketName
      );
      const bucket = this.storage.bucket(bucketName);
      const originalFileName = file.name;
      console.log(
        '🚀 ~ file: file.services.ts:17 ~ FileService ~ uploadFileToFirebase ~ originalFileName:',
        originalFileName
      );
      const fileName = `${uuidv4()}.webp`;
      const filePath = `${path}/${fileName}`;
      const fileUpload = bucket.file(filePath);
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(fileArrayBuffer);

      const convertedImageBuffer = await sharp(fileBuffer).toFormat('webp').toBuffer();

      const fileStream = new Readable();
      fileStream.push(convertedImageBuffer);
      fileStream.push(null); // Mark the end of the stream

      await new Promise((resolve, reject) => {
        fileStream
          .pipe(
            fileUpload.createWriteStream({
              metadata: {
                contentType: 'image/webp',
              },
              resumable: false,
            })
          )
          .on('error', reject)
          .on('finish', resolve);
      });

      const downloadUrl = await fileUpload.getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
      });

      return Promise.resolve(downloadUrl[0]);
    } catch (error) {
      console.error('Error uploading file:', error);
      rollbar.error('Error uploading file:', error);
      throw new Error('Failed to upload file.');
    }
  }

  public async removeFileFromFirebase(fileUrl: string) {
    console.log(
      '🚀 ~ file: file.services.ts:70 ~ FileService ~ removeFileFromFirebase ~ fileUrl:',
      fileUrl
    );
    try {
      const bucketName = process.env.FIREBASE_BUCKET;
      const bucket = this.storage.bucket(bucketName);

      const filePath = this.extractFilePathFromUrl(fileUrl);
      console.log(
        '🚀 ~ file: file.services.ts:75 ~ FileService ~ removeFileFromFirebase ~ filePath:',
        filePath
      );

      await bucket.file(filePath).delete();

      console.log('File removed successfully.');
    } catch (error) {
      console.error('Error removing file:', error);
      rollbar.error('Error removing file:', error);
      throw new Error('Failed to remove file.');
    }
  }
  public async downloadFileFromFirebase(url: string): Promise<Buffer> {
    try {
      const bucketName = process.env.FIREBASE_BUCKET;
      const filePath = this.extractFilePathFromUrl(url);

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);

      const fileData = await file.download();

      console.log('File downloaded successfully.');

      return fileData;
    } catch (error) {
      console.error('Error downloading file:', error);
      rollbar.error('Error downloading file:', error);
      throw new Error('Failed to download file from Firebase Storage.');
    }
  }

  private extractFilePathFromUrl(url: string): string {
    const firebaseUrl = process.env.FIREBASE_BUCKET + '/';
    console.log(
      '🚀 ~ file: file.services.ts:109 ~ FileService ~ extractFilePathFromUrl ~ firebaseUrl:',
      firebaseUrl
    );
    const startIndex = url.indexOf(firebaseUrl);
    if (startIndex !== -1) {
      const filePath = url.substring(startIndex + firebaseUrl.length);
      console.log(
        '🚀 ~ file: file.services.ts:113 ~ FileService ~ extractFilePathFromUrl ~ filePath:',
        filePath
      );
      return filePath.split('?')[0];
    } else {
      throw new Error('Invalid URL format');
    }
  }

  private calculateHash(buffer: ArrayBuffer): string {
    const hash = crypto.createHash('md5');
    hash.update(Buffer.from(buffer));
    return hash.digest('hex');
  }

  public async compareFiles(file: File, firebaseUrl: string): Promise<boolean> {
    console.log('comparing files');

    const fileBuffer = await this.downloadFileFromFirebase(firebaseUrl);
    const inputFileBuffer = await file.arrayBuffer();

    const fileHash = this.calculateHash(fileBuffer);
    const inputFileHash = this.calculateHash(inputFileBuffer);

    return fileHash === inputFileHash;
  }
}
