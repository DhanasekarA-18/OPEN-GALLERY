import mongoose, { Schema, Document } from 'mongoose';

export interface IPhoto extends Document {
  data: Buffer;
  contentType: string;
  title: string;
  uploadedBy: string;
  createdAt: Date;
}

const PhotoSchema: Schema = new Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  title: { type: String, required: true },
  uploadedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

if (mongoose.models.Photo) {
  delete (mongoose.models as any).Photo;
}

export default mongoose.model<IPhoto>('Photo', PhotoSchema);
