import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService (Tenant-Aware and Hardened)', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let audit: jest.Mocked<AuditService>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const prismaMock = {
      user: {
        findFirst: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    } as any;

    const auditMock = {
      log: jest.fn(),
    } as any;

    const jwtMock = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    audit = module.get(AuditService);
    jwt = module.get(JwtService);
  });

  describe('login', () => {
    it('throws if tenantId is missing or empty', async () => {
      await expect(service.login('test@email.com', 'pwd123', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('queries with tenantId + email + status:active', async () => {
      const passwordHash = await bcrypt.hash('pwd123', 10);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@email.com',
        tenantId: 'tenant-A',
        passwordHash,
        isSuperAdmin: false,
        status: 'active',
        userRoles: [],
      } as any);

      const res = await service.login('test@email.com', 'pwd123', 'tenant-A', 'corr-id');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@email.com', tenantId: 'tenant-A', status: 'active' },
        include: expect.any(Object),
      });
      expect(res.accessToken).toBe('mock-jwt-token');
      expect(audit.log).toHaveBeenCalledWith({
        tenantId: 'tenant-A',
        actorUserId: 'user-1',
        action: 'auth.login',
        correlationId: 'corr-id',
      });
    });

    it('fails if password does not match', async () => {
      const passwordHash = await bcrypt.hash('different-password', 10);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@email.com',
        tenantId: 'tenant-A',
        passwordHash,
        isSuperAdmin: false,
        status: 'active',
        userRoles: [],
      } as any);

      await expect(service.login('test@email.com', 'pwd123', 'tenant-A')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException if user status is not active', async () => {
      const tokenHash = await bcrypt.hash('refresh-raw', 10);
      (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rt-1',
          token: tokenHash,
          user: {
            id: 'user-1',
            email: 'test@email.com',
            tenantId: 'tenant-A',
            status: 'inactive',
            isSuperAdmin: false,
            userRoles: [],
          },
        },
      ] as any);

      await expect(service.refresh('refresh-raw')).rejects.toThrow(
        new UnauthorizedException('User is inactive or disabled'),
      );
    });
  });

  describe('logout', () => {
    it('logs audit event with correct tenantId', async () => {
      await service.logout('user-123', 'tenant-A', 'corr-123');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith({
        tenantId: 'tenant-A',
        actorUserId: 'user-123',
        action: 'auth.logout',
        correlationId: 'corr-123',
      });
    });
  });
});
