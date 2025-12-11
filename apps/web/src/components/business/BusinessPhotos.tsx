import Image from "next/image";

interface BusinessPhotosProps {
  businessName: string;
  photos?: string[];
}

export function BusinessPhotos({
  businessName,
  photos = [],
}: BusinessPhotosProps) {
  // Use placeholder image if no photos provided
  const bannerImage = photos.length > 0 ? photos[0] : 
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80"; // Wine bar

  return (
    <div className="relative w-full aspect-[5/2] rounded-xl overflow-hidden group">
      <Image
        src={bannerImage}
        alt={`${businessName} banner`}
        fill
        className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
        sizes="100vw"
        priority
      />
    </div>
  );
}

