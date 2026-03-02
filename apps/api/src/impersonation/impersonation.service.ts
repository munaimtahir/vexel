import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ADMIN_ROLE_NAMES,
  DEFAULT_IMPERSONATION_TTL_SECONDS,
  IMPERSONATION_COOKIE_NAME,
  IMPERSONATION_MODE,
} from './impersonation.constants';
import type { ImpersonationContext, ImpersonationCookiePayload } from './impersonation.types';
import { signImpersonationPayload, verifyImpersonationPayload } from './impersonation.signing';

interface SessionUser {
  userId: string;
  tenantId: string;
  isSuperAdmin?: boolean;
  roles?: string[];
  permissions?: string[];
  email?: string;
}

@Injectable()
export class ImpersonationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  getCookieName() {
    return IMPERSONATION_COOKIE_NAME;
  }

  private getSecret() {
    return process.env.IMPERSONATION_COOKIE_SECRET ?? process.env.JWT_SECRET ?? 'vexel-dev-secret-change-in-production';
  }

  getTtlSeconds() {
    const parsed = Number(process.env.IMPERSONATION_TTL_SECONDS ?? DEFAULT_IMPERSONATION_TTL_SECONDS);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_IMPERSONATION_TTL_SECONDS;
    return parsed;
  }

  getCookieOptions() {
    const secure = process.env.NODE_ENV === 'production';
    const domain = process.env.AUTH_COOKIE_DOMAIN;
    const maxAge = this.getTtlSeconds() * 1000;
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure,
      path: '/',
      maxAge,
      ...(domain ? { domain } : {}),
    };
  }

  canActAs(user: SessionUser) {
    if (user.isSuperAdmin) return true;
    const roles = user.roles ?? [];
    const perms = user.permissions ?? [];
    return roles.some((role) => ADMIN_ROLE_NAMES.has(role)) || perms.includes('admin.super');
  }

  private isPrivilegedTarget(user: { isSuperAdmin: boolean; roles: string[] }) {
    if (user.isSuperAdmin) return true;
    return user.roles.some((role) => ADMIN_ROLE_NAMES.has(role));
  }

  private getPayloadFromRequest(req: Request): ImpersonationCookiePayload | null {
    const token = (req as any).cookies?.[IMPERSONATION_COOKIE_NAME];
    if (!token) return null;
    return verifyImpersonationPayload(token, this.getSecret());
  }

  clearCookie(response: Response) {
    response.clearCookie(IMPERSONATION_COOKIE_NAME, this.getCookieOptions());
  }

  async start(
    actor: SessionUser,
    input: { userId: string; reason: string; correlationId?: string },
    req: Request,
    response: Response,
  ) {
    if (!this.canActAs(actor)) {
      throw new ForbiddenException('Only admin users can start impersonation');
    }

    const reason = (input.reason ?? '').trim();
    if (reason.length < 10) {
      throw new ForbiddenException('Impersonation reason must be at least 10 characters');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: input.userId, status: 'active' },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: true },
            },
          },
        },
      },
    });

    if (!target) {
      throw new ForbiddenException('Target user not found or inactive');
    }

    const targetRoles = target.userRoles.map((ur) => ur.role.name);
    if (this.isPrivilegedTarget({ isSuperAdmin: target.isSuperAdmin, roles: targetRoles })) {
      throw new ForbiddenException('Impersonating administrative users is not allowed');
    }

    if (!actor.isSuperAdmin && actor.tenantId !== target.tenantId) {
      throw new ForbiddenException('Cross-tenant impersonation is not allowed');
    }

    await this.prisma.impersonationSession.updateMany({
      where: { startedById: actor.userId, isActive: true },
      data: { isActive: false, endedAt: new Date(), endedIp: this.getIp(req) },
    });

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + this.getTtlSeconds() * 1000);

    const session = await this.prisma.impersonationSession.create({
      data: {
        tenantId: target.tenantId,
        startedById: actor.userId,
        impersonatedUserId: target.id,
        mode: IMPERSONATION_MODE,
        reason,
        startedAt,
        isActive: true,
        startedIp: this.getIp(req),
        userAgent: this.getUserAgent(req),
      },
    });

    const payload: ImpersonationCookiePayload = {
      session_id: session.id,
      impersonated_user_id: target.id,
      mode: IMPERSONATION_MODE,
      exp: Math.floor(expiresAt.getTime() / 1000),
    };

    response.cookie(IMPERSONATION_COOKIE_NAME, signImpersonationPayload(payload, this.getSecret()), this.getCookieOptions());

    await this.audit.log({
      tenantId: target.tenantId,
      actorUserId: actor.userId,
      action: 'impersonation.start',
      entityType: 'ImpersonationSession',
      entityId: session.id,
      after: {
        impersonatedUserId: target.id,
        mode: IMPERSONATION_MODE,
        reason,
        startedAt,
      },
      correlationId: input.correlationId,
      metadata: {
        startedIp: this.getIp(req),
        userAgent: this.getUserAgent(req),
      },
    });

    return {
      sessionId: session.id,
      impersonatedUser: {
        id: target.id,
        name: `${target.firstName} ${target.lastName}`.trim(),
        role: targetRoles[0] ?? null,
      },
      mode: IMPERSONATION_MODE,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async stop(actor: SessionUser, req: Request, response: Response, correlationId?: string) {
    const payload = this.getPayloadFromRequest(req);
    const now = new Date();

    if (payload) {
      await this.prisma.impersonationSession.updateMany({
        where: {
          id: payload.session_id,
          startedById: actor.userId,
          isActive: true,
        },
        data: {
          isActive: false,
          endedAt: now,
          endedIp: this.getIp(req),
        },
      });

      const ended = await this.prisma.impersonationSession.findUnique({ where: { id: payload.session_id } });
      if (ended) {
        await this.audit.log({
          tenantId: ended.tenantId,
          actorUserId: actor.userId,
          action: 'impersonation.stop',
          entityType: 'ImpersonationSession',
          entityId: ended.id,
          after: { endedAt: ended.endedAt, isActive: false },
          correlationId,
          metadata: {
            endedIp: this.getIp(req),
            userAgent: this.getUserAgent(req),
          },
        });
      }
    }

    this.clearCookie(response);
    return { ok: true };
  }

  async status(actor: SessionUser, req: Request) {
    const resolved = await this.resolve(actor, req);
    if (!resolved) return { active: false };

    const startedBy = `${resolved.session.startedBy.firstName} ${resolved.session.startedBy.lastName}`.trim();
    const targetName = `${resolved.session.impersonatedUser.firstName} ${resolved.session.impersonatedUser.lastName}`.trim();
    const targetRole = resolved.session.impersonatedUser.userRoles[0]?.role?.name ?? null;

    return {
      active: true,
      session_id: resolved.session.id,
      started_by: {
        id: resolved.session.startedBy.id,
        name: startedBy,
      },
      impersonated_user: {
        id: resolved.session.impersonatedUser.id,
        name: targetName,
        role: targetRole,
      },
      mode: resolved.session.mode,
      started_at: resolved.session.startedAt.toISOString(),
      expires_at: resolved.expiresAt.toISOString(),
    };
  }

  async resolve(actor: SessionUser, req: Request) {
    const payload = this.getPayloadFromRequest(req);
    if (!payload) return null;

    const expMs = payload.exp * 1000;
    if (Date.now() >= expMs) {
      return null;
    }

    if (!this.canActAs(actor)) {
      return null;
    }

    const session = await this.prisma.impersonationSession.findUnique({
      where: { id: payload.session_id },
      include: {
        startedBy: true,
        impersonatedUser: {
          include: {
            userRoles: {
              include: {
                role: {
                  include: { rolePermissions: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session || !session.isActive || session.mode !== IMPERSONATION_MODE) {
      return null;
    }

    if (session.startedById !== actor.userId) {
      return null;
    }

    if (!actor.isSuperAdmin && session.tenantId !== actor.tenantId) {
      return null;
    }

    if (session.impersonatedUserId !== payload.impersonated_user_id) {
      return null;
    }

    const expiresAt = new Date(expMs);
    return { session, expiresAt };
  }

  async applyToRequest(actor: SessionUser, req: Request) {
    const resolved = await this.resolve(actor, req);
    if (!resolved) return null;

    const userRoles = resolved.session.impersonatedUser.userRoles;
    const roles = userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission))),
    );

    const effectiveUser = {
      userId: resolved.session.impersonatedUser.id,
      email: resolved.session.impersonatedUser.email,
      tenantId: resolved.session.impersonatedUser.tenantId,
      roles,
      permissions,
      isSuperAdmin: resolved.session.impersonatedUser.isSuperAdmin,
    };

    const context: ImpersonationContext = {
      sessionId: resolved.session.id,
      mode: IMPERSONATION_MODE,
      startedById: resolved.session.startedById,
      expiresAt: resolved.expiresAt,
    };

    (req as any).realUser = actor;
    (req as any).user = effectiveUser;
    (req as any).impersonation = context;

    await this.prisma.impersonationSession.update({
      where: { id: resolved.session.id },
      data: { requestCount: { increment: 1 } },
    });

    return context;
  }

  async logBlockedWrite(args: {
    req: Request;
    actor: SessionUser;
    tenantId: string;
    correlationId?: string;
  }) {
    const context = (args.req as any).impersonation as ImpersonationContext | undefined;
    if (!context) return;

    await this.prisma.impersonationSession.update({
      where: { id: context.sessionId },
      data: {
        blockedWriteCount: { increment: 1 },
        lastBlockedMethod: args.req.method,
        lastBlockedPath: args.req.path,
        lastBlockedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId: args.tenantId,
      actorUserId: args.actor.userId,
      action: 'impersonation.write_blocked',
      entityType: 'ImpersonationSession',
      entityId: context.sessionId,
      after: {
        method: args.req.method,
        path: args.req.path,
      },
      correlationId: args.correlationId,
      metadata: {
        startedById: context.startedById,
        ip: this.getIp(args.req),
        userAgent: this.getUserAgent(args.req),
      },
    });
  }

  private getIp(req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? null;
  }

  private getUserAgent(req: Request) {
    const value = req.headers['user-agent'];
    return typeof value === 'string' ? value : null;
  }
}
