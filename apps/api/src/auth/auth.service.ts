import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  tenantId: string;
  roles: string[];
  isSuperAdmin: boolean;
}

const REFRESH_TOKEN_TTL_DAYS = 7;
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(email: string, password: string, correlationId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: 'active' },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: true } } } },
        tenant: true,
      },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const roles = user.userRoles.map((ur) => ur.role.name);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles,
      isSuperAdmin: user.isSuperAdmin,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshTokenRaw = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshTokenRaw, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenHash,
        expiresAt,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.login',
      correlationId,
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  async refresh(refreshTokenRaw: string) {
    const now = new Date();
    const candidates = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: now } },
      include: {
        user: {
          include: {
            userRoles: { include: { role: { include: { rolePermissions: true } } } },
          },
        },
      },
    });

    let matchedRecord: typeof candidates[0] | null = null;
    for (const record of candidates) {
      const match = await bcrypt.compare(refreshTokenRaw, record.token);
      if (match) { matchedRecord = record; break; }
    }

    if (!matchedRecord) throw new UnauthorizedException('Invalid or expired refresh token');

    await this.prisma.refreshToken.update({
      where: { id: matchedRecord.id },
      data: { revokedAt: now },
    });

    const user = matchedRecord.user;
    const roles = user.userRoles.map((ur) => ur.role.name);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles,
      isSuperAdmin: user.isSuperAdmin,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const newRefreshRaw = uuidv4();
    const newRefreshHash = await bcrypt.hash(newRefreshRaw, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: newRefreshHash, expiresAt },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.token_refresh',
    });

    return { accessToken, refreshToken: newRefreshRaw, expiresIn: 3600, tokenType: 'Bearer' };
  }

  async logout(userId: string, correlationId?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditService.log({
      tenantId: 'system',
      actorUserId: userId,
      action: 'auth.logout',
      correlationId,
    });
  }

  async createPasswordHash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
}
