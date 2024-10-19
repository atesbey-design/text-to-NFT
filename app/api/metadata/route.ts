import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// Cloudinary'yi yapılandırın
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_KEY,
  api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_SECRET,
});

// Görseli Cloudinary'ye yükleyen fonksiyon
const uploadImageToCloudinary = async (imageData: string): Promise<string> => {
  try {
    const result = await cloudinary.uploader.upload(imageData, {
      folder: 'nft-images', // İstediğiniz bir klasörü belirleyin
    });
    return result.secure_url; // Cloudinary'den gelen URL
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw error;
  }
};

// Metadata'yı Cloudinary'ye yükleyen fonksiyon
const uploadMetadataToCloudinary = async (metadata: object): Promise<string> => {
  try {
    const metadataId = uuidv4(); // Metadata için benzersiz ID
    const metadataFilePath = `/tmp/${metadataId}.json`; // Geçici JSON dosya yolu

    // Metadata'yı geçici bir JSON dosyasına yazıyoruz
    await fs.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2));

    // JSON dosyasını Cloudinary'ye yüklüyoruz
    const result = await cloudinary.uploader.upload(metadataFilePath, {
      folder: 'nft-metadata',
      resource_type: 'raw', // raw tipi JSON gibi dosyalar için
    });

    return result.secure_url; // Metadata'nın URL'si
  } catch (error) {
    console.error('Error uploading metadata to Cloudinary:', error);
    throw error;
  }
};

// API Route (Vercel üzerinde çalışacak)
export async function POST(req: Request) {
  try {
    // İstekten gelen verileri alıyoruz
    const { imageData, name, description } = await req.json();
    console.log("Received data:", name, description);

    // Görseli Cloudinary'ye yükle
    const imageUrl = await uploadImageToCloudinary(imageData);

    // Metadata'yı oluştur
    const metadata = {
      name: name || 'Default NFT Name',
      description: description || 'Default NFT Description',
      image: imageUrl,  // Cloudinary'den gelen görsel URL
      attributes: [
        {
          trait_type: 'AI Generated',
          value: 'True'
        }
      ]
    };

    // Metadata'yı Cloudinary'ye yükle
    const metadataUrl = await uploadMetadataToCloudinary(metadata);

    // Frontend'de mint işlemi yapılmak üzere metadata URL'sini döndür
    return NextResponse.json({
      message: 'Metadata başarıyla oluşturuldu',
      metadataUrl: metadataUrl, // Frontend'de kullanılacak metadata URL'si
      imageUrl: imageUrl // İstersen görsel URL'sini de döndürebilirsin
    });
  } catch (error) {
    console.error('Error in POST request:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
