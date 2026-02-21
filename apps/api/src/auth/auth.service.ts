import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(email: string, password: string) {
    // TODO: validate against DB, bcrypt compare
    // Stub: accept any credentials in dev, return a signed token
    if (!email || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: 'stub-user-id', email, roles: ['admin'] };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const newPayload = { sub: payload.sub, email: payload.email, roles: payload.roles };
      const accessToken = this.jwtService.sign(newPayload, { expiresIn: '1h' });
      const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });
      return { accessToken, refreshToken: newRefreshToken, expiresIn: 3600, tokenType: 'Bearer' };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
