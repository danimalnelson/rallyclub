import { ThreePhotoLayout } from "@/components/ThreePhotoLayout";

export default function PhotoLayoutTestPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">ThreePhotoLayout Component Test</h1>
          <p className="text-muted-foreground">
            Testing responsive image layout with consistent aspect ratios
          </p>
        </div>

        {/* Test 1: Default 3:2 aspect ratio */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Test 1: Default (3:2 aspect ratio)</h2>
          <ThreePhotoLayout
            leftSrc="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80"
            topRightSrc="https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80"
            bottomRightSrc="https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=80"
            leftAlt="Wine bar interior"
            topRightAlt="Wine glasses"
            bottomRightAlt="Wine bottles on shelf"
          />
        </section>

        {/* Test 2: 4:3 aspect ratio */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Test 2: 4:3 aspect ratio</h2>
          <ThreePhotoLayout
            leftSrc="https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80"
            topRightSrc="https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80"
            bottomRightSrc="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
            aspectRatio="4/3"
            leftAlt="Food dish"
            topRightAlt="Pancakes"
            bottomRightAlt="Pasta"
          />
        </section>

        {/* Test 3: 16:9 aspect ratio */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Test 3: 16:9 aspect ratio (widescreen)</h2>
          <ThreePhotoLayout
            leftSrc="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80"
            topRightSrc="https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80"
            bottomRightSrc="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80"
            aspectRatio="16/9"
            leftAlt="Mountain landscape"
            topRightAlt="Forest path"
            bottomRightAlt="Desert landscape"
          />
        </section>

        {/* Test 4: With custom className */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Test 4: Custom styling</h2>
          <ThreePhotoLayout
            leftSrc="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80"
            topRightSrc="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80"
            bottomRightSrc="https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800&q=80"
            className="opacity-90 hover:opacity-100 transition-opacity"
            leftAlt="Nature scene"
            topRightAlt="Nature vista"
            bottomRightAlt="Nature view"
          />
        </section>

        {/* Implementation notes */}
        <section className="bg-muted p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Implementation Notes</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✓ All images maintain the same aspect ratio (e.g., 3:2)</li>
            <li>✓ Left image is 2× the width and 2× the height of each right image</li>
            <li>✓ Right images are stacked vertically in a single column</li>
            <li>✓ Fully responsive: stacks vertically on mobile</li>
            <li>✓ Hover effect: scales images on hover</li>
            <li>✓ Uses Next.js Image component for optimization</li>
            <li>✓ Configurable aspect ratio via props</li>
          </ul>
        </section>
      </div>
    </div>
  );
}


