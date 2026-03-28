import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class GeoService {
  getCountryFromRequest(req: Request) {
    const direct = req.headers['x-country'];
    const country = Array.isArray(direct) ? direct[0] : direct;
    return (country ?? '').toUpperCase();
  }

  getBlockedCountries() {
    const raw = process.env.BLOCKED_COUNTRIES ?? '';
    return raw
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  }

  assertAllowed(req: Request) {
    const blocked = this.getBlockedCountries();
    if (blocked.length === 0) return;
    const country = this.getCountryFromRequest(req);
    if (!country) return;
    if (blocked.includes(country)) {
      throw new ForbiddenException('Region restricted');
    }
  }
}
