import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const ensureDirectoryExists = async (dirPath: string) => {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

const saveImage = async (imageData: string): Promise<string> => {
  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const imageName = `${uuidv4()}.png`;
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    await ensureDirectoryExists(imagesDir);
    const imagePath = path.join(imagesDir, imageName);
    await fs.writeFile(imagePath, buffer);
    return `/images/${imageName}`;
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
};

export async function POST(req: Request) {
  try {
    const { imageData, name, description } = await req.json();
    console.log("Received data:", name, description);
    
    // Save image
    const savedImagePath = await saveImage(imageData);

    // Create metadata for NFT
    const metadata = {
      name: name || `NFT ${path.basename(savedImagePath)}`,
      description: description || `NFT created from ${path.basename(savedImagePath)}`,
      image: process.env.NEXT_PUBLIC_URL + savedImagePath,
      attributes: [
        {
          trait_type: 'image',
          value: path.basename(savedImagePath)
        }
      ]
    };

    // Save metadata
    const metadataId = uuidv4();
    const metadataDir = path.join(process.cwd(), 'public', 'metadata');
    await ensureDirectoryExists(metadataDir);
    const metadataPath = path.join(metadataDir, `${metadataId}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return NextResponse.json({
      metadataUrl: process.env.NEXT_PUBLIC_URL + `/metadata/${metadataId}.json`,
      imageUrl: savedImagePath
    });
  } catch (error) {
    console.error('Error in POST request:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}