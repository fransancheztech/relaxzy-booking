import { useEffect, useState } from 'react';

export interface ServicePriceLookup {
  id: string;
  name: string;
  duration: string;
  price: string;
}

/**
 * Hook that calculates the price for a booking based on service name and duration.
 * Fetches all services and looks up the matching price.
 */
export const usePriceCalculator = (serviceName: string | undefined, duration: string | undefined) => {
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serviceName || !duration) {
      setPrice(null);
      return;
    }

    const lookupPrice = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/services');
        if (!res.ok) {
          setPrice(null);
          return;
        }

        const services: ServicePriceLookup[] = await res.json();
        
        // Find matching service by name and duration
        const matching = services.find(
          (s) => s.name === serviceName && s.duration === duration
        );

        setPrice(matching?.price || null);
      } catch (err) {
        console.error('Error looking up price:', err);
        setPrice(null);
      } finally {
        setLoading(false);
      }
    };

    lookupPrice();
  }, [serviceName, duration]);

  return { price, loading };
};
