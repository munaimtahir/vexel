import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { Permission } from './permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Not authenticated');

    if (user.isSuperAdmin === true) return true;

    const userPermissions: string[] = user.permissions ?? [];

    const hasAll = required.every((perm) => userPermissions.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException(
        `Missing required permissions: ${required.filter(p => !userPermissions.includes(p)).join(', ')}`,
      );
    }

    return true;
  }
}
