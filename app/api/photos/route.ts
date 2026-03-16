import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Photo from '@/models/Photo';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const titles = formData.getAll('titles') as string[];

    if (!files || files.length === 0) {
      return NextResponse.json({ message: 'No files provided' }, { status: 400 });
    }

    await connectDB();

    const savedPhotos = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const title = titles[i] || `Untitled Shot ${i + 1}`;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const newPhoto = new Photo({
        data: buffer,
        contentType: file.type,
        title,
        uploadedBy: user.email,
      });

      await newPhoto.save();
      savedPhotos.push(newPhoto._id);
    }

    return NextResponse.json({
      message: `${savedPhotos.length} photos saved successfully`,
      photoIds: savedPhotos
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error saving photo:', error);
    return NextResponse.json({ message: 'Failed to save photo(s) to MongoDB' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '8');
    const skip = (page - 1) * limit;

    await connectDB();
    const photos = await Photo.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Photo.countDocuments();
    const hasMore = skip + photos.length < total;

    const formattedPhotos = photos.map(photo => ({
      _id: photo._id,
      title: photo.title,
      uploadedBy: photo.uploadedBy,
      createdAt: photo.createdAt,
      url: `data:${photo.contentType};base64,${photo.data.toString('base64')}`
    }));

    return NextResponse.json({ photos: formattedPhotos, hasMore });
  } catch (error: any) {
    console.error('Error fetching photos:', error);
    return NextResponse.json({ message: 'Failed to fetch photos' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ message: 'Photo ID is required' }, { status: 400 });
    }

    await connectDB();
    const photo = await Photo.findById(id);

    if (!photo) {
      return NextResponse.json({ message: 'Photo not found' }, { status: 404 });
    }

    if (photo.uploadedBy !== user.email) {
      return NextResponse.json({ message: 'Permission denied' }, { status: 403 });
    }

    await Photo.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Photo deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting photo:', error);
    return NextResponse.json({ message: 'Failed to delete photo' }, { status: 500 });
  }
}
