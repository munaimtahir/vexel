import {
  Controller, Post, Get, Body, HttpCode, HttpStatus,
  UseGuards, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  async login(
    @Body() body: { email: string; password: string },
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.authService.login(body.email, body.password, correlationId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token (rotates refresh token)' })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (revokes all refresh tokens)' })
  async logout(
    @Req() req: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    await this.authService.logout(user.userId, correlationId);
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
