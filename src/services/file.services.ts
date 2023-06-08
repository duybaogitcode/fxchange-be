import { app } from '@src/libs/firebase';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class FileService {
  private storage: any;

  public constructor() {
    this.storage = app.storage();
  }

  public async uploadFileToFirebase(file: File, path: string) {
    try {
      const bucketName = 'fexchange-b23e0.appspot.com';
      const bucket = this.storage.bucket(bucketName);
      const originalFileName = file.name;
      const fileExtension = originalFileName.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const filePath = `${path}/${fileName}`;
      const fileUpload = bucket.file(filePath);
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(fileArrayBuffer);

      const fileStream = new Readable();
      fileStream.push(fileBuffer);
      fileStream.push(null); // Mark the end of the stream

      await new Promise((resolve, reject) => {
        fileStream
          .pipe(
            fileUpload.createWriteStream({
              metadata: {
                contentType: file.type,
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
      throw new Error('Failed to upload file.');
    }
  }

  public async removeFileFromFirebase(fileUrl: string) {
    try {
      const bucketName = 'fexchange-b23e0.appspot.com';
      const bucket = this.storage.bucket(bucketName);

      const filePath = this.extractFilePathFromUrl(fileUrl);

      await bucket.file(filePath).delete();

      console.log('File removed successfully.');
    } catch (error) {
      console.error('Error removing file:', error);
      throw new Error('Failed to remove file.');
    }
  }
  public async downloadFileFromFirebase(url: string): Promise<Buffer> {
    try {
      const bucketName = 'fexchange-b23e0.appspot.com';
      const filePath = this.extractFilePathFromUrl(url);

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);

      const fileData = await file.download();

      console.log('File downloaded successfully.');

      return fileData;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('Failed to download file from Firebase Storage.');
    }
  }

  private extractFilePathFromUrl(url: string): string {
    const startIndex = url.indexOf('fexchange-b23e0.appspot.com/');
    if (startIndex !== -1) {
      const filePath = url.substring(startIndex + 'fexchange-b23e0.appspot.com/'.length);
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
