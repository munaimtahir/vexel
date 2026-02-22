import {
  Controller, Post, Get, Body, HttpCode, HttpStatus,
  UseGuards, Req, Headers, Res, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';

const REFRESH_COOKIE = 'vexel_refresh';

function refreshCookieOptions(secure: boolean, domain?: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/api/auth',
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(domain ? { domain } : {}),
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  async login(
    @Body() body: { email: string; password: string },
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body.email, body.password, correlationId);
    const domain = process.env.AUTH_COOKIE_DOMAIN;
    const secure = process.env.NODE_ENV === 'production';
    response.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(secure, domain));
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token (rotates refresh token)' })
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieToken = (req as any).cookies?.[REFRESH_COOKIE];
    const token = cookieToken || body.refreshToken;
    if (!token) throw new UnauthorizedException('Refresh token required');
    const result = await this.authService.refresh(token);
    const domain = process.env.AUTH_COOKIE_DOMAIN;
    const secure = process.env.NODE_ENV === 'production';
    response.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(secure, domain));
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (revokes all refresh tokens)' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    await this.authService.logout(user.userId, correlationId);
    response.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }
}

@ApiTags('Auth')
@Controller('me')
export class MeController {
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  getMe(@Req() req: Request) {
    return (req as any).user;
  }
}
