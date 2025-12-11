import Image from "next/image";

export type ThreePhotoLayoutProps = {
  leftSrc: string;
  topRightSrc: string;
  bottomRightSrc: string;
  aspectRatio?: string; // e.g., "3/2", "4/3", "16/9"
  className?: string;
  leftAlt?: string;
  topRightAlt?: string;
  bottomRightAlt?: string;
};

/**
 * ThreePhotoLayout - A responsive image layout component
 * 
 * Displays one large image on the left and two smaller images stacked on the right.
 * All three images maintain the same aspect ratio.
 * 
 * Example: If aspectRatio is "3/2", the left image might be 600×400 and each right image 300×200.
 * 
 * Layout:
 * Desktop:
 * +----------------------+---------------+
 * |                      |   top-right   |
 * |      left image      +---------------+
 * |                      | bottom-right  |
 * +----------------------+---------------+
 * 
 * Mobile: All images stack vertically while maintaining aspect ratio.
 */
export function ThreePhotoLayout({
  leftSrc,
  topRightSrc,
  bottomRightSrc,
  aspectRatio = "3/2",
  className = "",
  leftAlt = "Left image",
  topRightAlt = "Top right image",
  bottomRightAlt = "Bottom right image",
}: ThreePhotoLayoutProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${className}`}>
      {/* Left image - large, maintains aspect ratio */}
      <div className={`relative rounded-xl overflow-hidden group aspect-[${aspectRatio}]`}>
        <Image
          src={leftSrc}
          alt={leftAlt}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </div>

      {/* Right column - two stacked images */}
      <div className="grid grid-rows-2 gap-3">
        {/* Top right image */}
        <div className={`relative rounded-xl overflow-hidden group aspect-[${aspectRatio}]`}>
          <Image
            src={topRightSrc}
            alt={topRightAlt}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 25vw"
          />
        </div>

        {/* Bottom right image */}
        <div className={`relative rounded-xl overflow-hidden group aspect-[${aspectRatio}]`}>
          <Image
            src={bottomRightSrc}
            alt={bottomRightAlt}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 25vw"
          />
        </div>
      </div>
    </div>
  );
}


