import pool from '../config/database';
import { CreatePodRequest, UpdatePodRequest, PodSearchRequest, PodWithDistance } from '../models/Pod';
import { ValidationUtils } from '../utils/validation';

export class PodService {
  async createPod(podData: CreatePodRequest): Promise<any> {
    const { pod_number, description, location_id, address, latitude, longitude, price_per_hour, max_capacity, amenities } = podData;

    if (!ValidationUtils.isValidCoordinates(latitude, longitude)) {
      throw new Error('Invalid coordinates');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertPodQuery = `
        INSERT INTO pods (pod_number, description, location_id, address, coordinates, price_per_hour, max_capacity)
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8)
        RETURNING *
      `;

      const podResult = await client.query(insertPodQuery, [
        pod_number, description, location_id, address, longitude, latitude, price_per_hour, max_capacity
      ]);

      const newPod = podResult.rows[0];

      // Add amenities if provided
      if (amenities && amenities.length > 0) {
        const amenityInserts = amenities.map((amenityId, index) => 
          `($1, $${index + 2})`
        ).join(', ');

        const insertAmenitiesQuery = `
          INSERT INTO pod_amenities (pod_id, amenity_id)
          VALUES ${amenityInserts}
        `;

        await client.query(insertAmenitiesQuery, [newPod.id, ...amenities]);
      }

      await client.query('COMMIT');
      return newPod;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePod(podId: string, updateData: UpdatePodRequest): Promise<any> {
    const { pod_number, description, location_id, status, address, latitude, longitude, price_per_hour, max_capacity, amenities } = updateData;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let valueIndex = 1;

      if (pod_number) {
        updateFields.push(`pod_number = $${valueIndex++}`);
        updateValues.push(pod_number);
      }
      if (description) {
        updateFields.push(`description = $${valueIndex++}`);
        updateValues.push(description);
      }
      if (location_id) {
        updateFields.push(`location_id = $${valueIndex++}`);
        updateValues.push(location_id);
      }
      if (status) {
        updateFields.push(`status = $${valueIndex++}`);
        updateValues.push(status);
      }
      if (address) {
        updateFields.push(`address = $${valueIndex++}`);
        updateValues.push(address);
      }
      if (latitude && longitude && ValidationUtils.isValidCoordinates(latitude, longitude)) {
        updateFields.push(`coordinates = ST_SetSRID(ST_MakePoint($${valueIndex}, $${valueIndex + 1}), 4326)`);
        updateValues.push(longitude, latitude);
        valueIndex += 2;
      }
      if (price_per_hour) {
        updateFields.push(`price_per_hour = $${valueIndex++}`);
        updateValues.push(price_per_hour);
      }
      if (max_capacity) {
        updateFields.push(`max_capacity = $${valueIndex++}`);
        updateValues.push(max_capacity);
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(podId);

      if (updateFields.length > 1) { // More than just updated_at
        const updateQuery = `
          UPDATE pods 
          SET ${updateFields.join(', ')}
          WHERE pod_id = $${valueIndex}
          RETURNING *
        `;

        const result = await client.query(updateQuery, updateValues);

        if (result.rows.length === 0) {
          throw new Error('Pod not found');
        }

        const updatedPod = result.rows[0];

        // Update amenities if provided
        if (amenities) {
          // Delete existing amenities
          await client.query('DELETE FROM pod_amenities WHERE pod_id = $1', [updatedPod.id]);

          // Add new amenities
          if (amenities.length > 0) {
            const amenityInserts = amenities.map((_, index) => 
              `($1, $${index + 2})`
            ).join(', ');

            const insertAmenitiesQuery = `
              INSERT INTO pod_amenities (pod_id, amenity_id)
              VALUES ${amenityInserts}
            `;

            await client.query(insertAmenitiesQuery, [updatedPod.id, ...amenities]);
          }
        }

        await client.query('COMMIT');
        return updatedPod;
      } else {
        throw new Error('No fields to update');
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPodById(podId: string): Promise<any> {
    const query = `
      SELECT 
        p.*,
        pl.area, pl.city, pl.state, pl.country, pl.pincode,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'name', a.name,
              'amenity_icon', a.amenity_icon
            )
          ) FILTER (WHERE a.id IS NOT NULL), 
          '[]'::json
        ) as amenities
      FROM pods p
      LEFT JOIN pod_location pl ON p.location_id = pl.id
      LEFT JOIN pod_amenities pa ON p.id = pa.pod_id
      LEFT JOIN amenities a ON pa.amenity_id = a.id
      WHERE p.pod_id = $1
      GROUP BY p.id, pl.area, pl.city, pl.state, pl.country, pl.pincode
    `;

    const result = await pool.query(query, [podId]);

    if (result.rows.length === 0) {
      throw new Error('Pod not found');
    }

    return result.rows[0];
  }

  async getAllPods(limit: number = 50, offset: number = 0): Promise<any[]> {
    const query = `
      SELECT 
        p.*,
        pl.area, pl.city, pl.state, pl.country, pl.pincode,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'name', a.name,
              'amenity_icon', a.amenity_icon
            )
          ) FILTER (WHERE a.id IS NOT NULL), 
          '[]'::json
        ) as amenities
      FROM pods p
      LEFT JOIN pod_location pl ON p.location_id = pl.id
      LEFT JOIN pod_amenities pa ON p.id = pa.pod_id
      LEFT JOIN amenities a ON pa.amenity_id = a.id
      GROUP BY p.id, pl.area, pl.city, pl.state, pl.country, pl.pincode
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    // const query = `select * from pods order by created_at desc limit $1 offset $2`; // --- IGNORE ---
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  async getPodsNearUser(searchData: PodSearchRequest): Promise<PodWithDistance[]> {
    const { latitude, longitude, range, check_in, check_out, capacity } = searchData;

    if (!ValidationUtils.isValidCoordinates(latitude, longitude)) {
      throw new Error('Invalid coordinates');
    }

    let availabilityCheck = '';
    let queryParams = [longitude, latitude, range * 1000]; // Convert km to meters
    let paramIndex = 4;

    // Add availability check if dates provided
    if (check_in && check_out) {
      if (!ValidationUtils.isValidDateRange(check_in, check_out)) {
        throw new Error('Invalid date range');
      }

      availabilityCheck = `
        AND p.id NOT IN (
          SELECT DISTINCT b.pod_id 
          FROM bookings b 
          WHERE b.booking_status = 'confirmed'
          AND (
            (b.check_in <= $${paramIndex} AND b.check_out > $${paramIndex}) OR
            (b.check_in < $${paramIndex + 1} AND b.check_out >= $${paramIndex + 1}) OR
            (b.check_in >= $${paramIndex} AND b.check_out <= $${paramIndex + 1})
          )
        )
      `;
      queryParams.push(Date.parse(check_in), Date.parse(check_out));
      paramIndex += 2;
    }

    // Add capacity filter
    if (capacity) {
      availabilityCheck += ` AND p.max_capacity >= $${paramIndex}`;
      queryParams.push(capacity);
    }

    const query = `
      SELECT 
        p.*,
        pl.area, pl.city, pl.state, pl.country, pl.pincode,
        ST_Distance(p.coordinates, ST_SetSRID(ST_MakePoint($1, $2), 4326)) / 1000 as distance_km,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'name', a.name,
              'amenity_icon', a.amenity_icon
            )
          ) FILTER (WHERE a.id IS NOT NULL), 
          '[]'::json
        ) as amenities
      FROM pods p
      LEFT JOIN pod_location pl ON p.location_id = pl.id
      LEFT JOIN pod_amenities pa ON p.id = pa.pod_id
      LEFT JOIN amenities a ON pa.amenity_id = a.id
      WHERE ST_DWithin(p.coordinates, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
      AND p.status = 'available'
      ${availabilityCheck}
      GROUP BY p.id, pl.area, pl.city, pl.state, pl.country, pl.pincode, p.coordinates
      ORDER BY distance_km ASC
      LIMIT 50
    `;

    const result = await pool.query(query, queryParams);
    return result.rows;
  }
}
