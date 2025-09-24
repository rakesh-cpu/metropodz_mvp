import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer, { FileFilterCallback } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { Request } from 'express';

dotenv.config();

export const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.ACCESSKEYID!,
    secretAccessKey: process.env.SECRETEACCESSKEYID!
  }
});


export const memoryStorage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

export const uploadToS3 = async (
  file: Express.Multer.File,
  userId: string,
  imageType: 'selfie' | 'aadhar'
): Promise<string> => {
  const timestamp = Date.now();
  const randomId = uuidv4().substring(0, 8);
  const ext = path.extname(file.originalname);
  const key = `${imageType}/${userId}/${timestamp}-${randomId}${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read' 
  });

  await s3.send(command);
  
  const publicUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return publicUrl;
};
