import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
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

function refreshTokenLookupHash(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) { }

  async login(email: string, password: string, tenantId: string, correlationId?: string) {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context not resolved');
    }
    const user = await this.prisma.user.findFirst({
      where: { email, tenantId, status: 'active' },
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
        tokenLookupHash: refreshTokenLookupHash(refreshTokenRaw),
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

  async refresh(refreshTokenRaw: string, correlationId?: string) {
    const now = new Date();
    const lookupHash = refreshTokenLookupHash(refreshTokenRaw);
    const candidate = await this.prisma.refreshToken.findFirst({
      where: { tokenLookupHash: lookupHash, revokedAt: null, expiresAt: { gt: now } },
      include: {
        user: {
          include: {
            userRoles: { include: { role: { include: { rolePermissions: true } } } },
          },
        },
      },
    });

    // Legacy rows created before the lookup column was deployed may have no
    // digest. They use a one-time compatibility fallback and are upgraded on
    // their next refresh; all new sessions use the indexed lookup above.
    let matchedRecord: typeof candidate = null;
    if (candidate && await bcrypt.compare(refreshTokenRaw, candidate.token)) {
      matchedRecord = candidate;
    }

    if (!matchedRecord) {
      const legacyCandidates = await this.prisma.refreshToken.findMany({
        where: { tokenLookupHash: null, revokedAt: null, expiresAt: { gt: now } },
        include: { user: { include: { userRoles: { include: { role: { include: { rolePermissions: true } } } } } } },
      });
      for (const legacy of legacyCandidates) {
        if (await bcrypt.compare(refreshTokenRaw, legacy.token)) {
          matchedRecord = legacy;
          break;
        }
      }
    }

    if (!matchedRecord) {
      // A previously rotated token must remain unusable, but a matching
      // revoked digest is still useful evidence of refresh-token replay.
      const revokedCandidate = await this.prisma.refreshToken.findFirst({
        where: { tokenLookupHash: lookupHash, revokedAt: { not: null } },
        include: { user: true },
      });
      if (revokedCandidate && await bcrypt.compare(refreshTokenRaw, revokedCandidate.token)) {
        await this.auditService.log({
          tenantId: revokedCandidate.user.tenantId,
          actorUserId: revokedCandidate.userId,
          action: 'auth.refresh.reuse_detected',
          entityType: 'RefreshToken',
          entityId: revokedCandidate.id,
          correlationId,
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = matchedRecord.user;
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User is inactive or disabled');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedRecord.id },
      data: { revokedAt: now },
    });

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
      data: {
        userId: user.id,
        token: newRefreshHash,
        tokenLookupHash: refreshTokenLookupHash(newRefreshRaw),
        expiresAt,
      },
    });

    if (matchedRecord.tokenLookupHash === null || matchedRecord.tokenLookupHash === undefined) {
      await this.prisma.refreshToken.update({
        where: { id: matchedRecord.id },
        data: { tokenLookupHash: lookupHash },
      });
    }

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.token_refresh',
      correlationId,
    });

    return { accessToken, refreshToken: newRefreshRaw, expiresIn: 3600, tokenType: 'Bearer' };
  }

  async logout(userId: string, tenantId: string, correlationId?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditService.log({
      tenantId,
      actorUserId: userId,
      action: 'auth.logout',
      correlationId,
    });
  }

  async createPasswordHash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
}
