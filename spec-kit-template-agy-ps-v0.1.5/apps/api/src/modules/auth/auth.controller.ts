import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await this.authService.register(dto.email, dto.password);
    req.session.userId = user.id;
    return { user };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.login(dto.email, dto.password);
    req.session.userId = user.id;
    return { user };
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const userId = req.session.userId!;
    const user = await this.authService.getSafeUserById(userId);
    const isAdmin = user ? this.authService.isAdminUser(user) : false;
    const includeDebug = process.env.NODE_ENV !== 'production';
    return {
      user,
      isAdmin,
      adminDebug: includeDebug && user ? this.authService.getAdminConfigSummaryFor(user) : undefined,
    };
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(req.session.userId!, dto.currentPassword, dto.newPassword);
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    return { ok: true, relogin: true };
  }
}
