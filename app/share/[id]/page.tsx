import { Metadata } from 'next';
import ClientRedirect from './ClientRedirect';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const { id } = await params;
  let score = 0;
  let dist = 0;
  let mapUrl = '';

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (db && mapsKey) {
    try {
      const docSnap = await getDoc(doc(db, 'shares', id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        score = data.score;
        dist = data.distance;
        
        const actual = data.actualLocation;
        const guess = data.guessLocation;

        if (actual && guess) {
          mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=1200x630&maptype=hybrid&markers=color:0x00ff00|label:X|${actual.lat},${actual.lng}&markers=color:0xff0000|label:G|${guess.lat},${guess.lng}&path=color:0xff0000ff|weight:5|${actual.lat},${actual.lng}|${guess.lat},${guess.lng}&key=${mapsKey}`;
        }
      }
    } catch (e) {
      console.error("Metadata fetch error:", e);
    }
  }

  const fallbackImage = 'https://pei-guessr.vercel.app/bg-pei.png';

  const title = `I scored ${score} points under pressure on RedDirtRadar!`;
  const description = `I was absolutely lost on a PEI country road and managed to guess within ${dist.toFixed(1)} km! Can you beat my record?`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://pei-guessr.vercel.app/share/${id}`,
      type: 'website',
      images: [
        {
          url: mapUrl || fallbackImage,
          width: 1200,
          height: 630,
          alt: 'PEIGuessr Map Result',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [mapUrl || fallbackImage],
    }
  };
}

export default function SharePage() {
  return <ClientRedirect />;
}
