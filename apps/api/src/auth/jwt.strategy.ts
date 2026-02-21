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
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: payload.sub },
      include: { role: { include: { rolePermissions: true } } },
    });

    const permissions = userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission),
    );

    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles,
      isSuperAdmin: payload.isSuperAdmin ?? false,
      permissions,
    };
  }
}
