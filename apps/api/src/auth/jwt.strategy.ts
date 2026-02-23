import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'vexel-dev-secret-change-in-production',
    });
  }

  async validate(payload: any) {
    // Load user + roles + permissions from DB on every request.
    // isSuperAdmin is read from DB — never trusted from JWT claim.
    const [user, userRoles] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: payload.sub }, select: { isSuperAdmin: true, status: true } }),
      this.prisma.userRole.findMany({
        where: { userId: payload.sub },
        include: { role: { include: { rolePermissions: true } } },
      }),
    ]);

    // Reject if user has been deactivated since token was issued
    if (!user || user.status !== 'active') return null;

    const permissions = userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission),
    );

    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles,
      isSuperAdmin: user.isSuperAdmin,   // live DB value — not JWT claim
      permissions,
    };
  }
}
