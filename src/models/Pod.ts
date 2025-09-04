export interface Pod {
  id: number;
  pod_id: string;
  pod_number: string;
  description?: string;
  location_id?: number;
  status: 'available' | 'occupied' | 'maintenance';
  address?: string;
  coordinates: string;
  price_per_hour: number;
  max_capacity: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePodRequest {
  pod_number: string;
  description?: string;
  location_id?: number;
  address?: string;
  latitude: number;
  longitude: number;
  price_per_hour: number;
  max_capacity: number;
  amenities?: number[];
}

export interface UpdatePodRequest {
  pod_number?: string;
  description?: string;
  location_id?: number;
  status?: 'available' | 'occupied' | 'maintenance';
  address?: string;
  latitude?: number;
  longitude?: number;
  price_per_hour?: number;
  max_capacity?: number;
  amenities?: number[];
}

export interface PodSearchRequest {
  latitude: number;
  longitude: number;
  range: number; // in kilometers
  check_in?: string;
  check_out?: string;
  capacity?: number;
}

export interface PodWithDistance extends Pod {
  distance_km: number;
  amenities: Array<{
    id: number;
    name: string;
    amenity_icon?: string;
  }>;
}
