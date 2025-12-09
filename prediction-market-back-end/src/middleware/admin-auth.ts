/**
 * Admin Authentication Middleware
 *
 * Validates admin JWT tokens and checks admin roles
 */

import { FastifyRequest, FastifyReply } from 'fastify';

// Admin wallet addresses (should be in environment variables in production)
const ADMIN_ADDRESSES = process.env.ADMIN_ADDRESSES?.split(',') || [];
const SUPER_ADMIN_ADDRESSES = process.env.SUPER_ADMIN_ADDRESSES?.split(',') || [];

export type AdminRole = 'admin' | 'super_admin';

export interface AdminUser {
  address: string;
  role: AdminRole;
}

/**
 * Check if an address is an admin
 */
export function getAdminRole(address: string): AdminRole | null {
  if (SUPER_ADMIN_ADDRESSES.includes(address)) {
    return 'super_admin';
  }
  if (ADMIN_ADDRESSES.includes(address)) {
    return 'admin';
  }
  return null;
}

/**
 * Admin authentication middleware
 * Requires a valid user with admin privileges
 */
export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Get user from previous auth middleware or headers
  const userAddress =
    (request as any).user?.address ||
    request.headers['x-user-address'] as string;

  if (!userAddress) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
      },
    });
    return;
  }

  const role = getAdminRole(userAddress);

  if (!role) {
    reply.status(403).send({
      success: false,
      error: {
        code: 'forbidden',
        message: 'Admin access required',
      },
    });
    return;
  }

  // Attach admin info to request
  (request as any).admin = {
    address: userAddress,
    role,
  } as AdminUser;
}

/**
 * Super admin only middleware
 */
export async function superAdminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // First run admin auth
  await adminAuthMiddleware(request, reply);

  // Check if already replied (unauthorized)
  if (reply.sent) return;

  const admin = (request as any).admin as AdminUser;

  if (admin.role !== 'super_admin') {
    reply.status(403).send({
      success: false,
      error: {
        code: 'forbidden',
        message: 'Super admin access required',
      },
    });
    return;
  }
}

/**
 * Create middleware that requires specific admin permission
 */
export function requireAdminPermission(permission: string) {
  return async function permissionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    await adminAuthMiddleware(request, reply);

    if (reply.sent) return;

    const admin = (request as any).admin as AdminUser;

    // Super admins have all permissions
    if (admin.role === 'super_admin') return;

    // Define permission mappings for regular admins
    const adminPermissions: Record<string, string[]> = {
      admin: [
        'proposals.read',
        'proposals.review',
        'disputes.read',
        'disputes.review',
        'config.read',
      ],
    };

    const allowedPermissions = adminPermissions[admin.role] || [];

    if (!allowedPermissions.includes(permission)) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'forbidden',
          message: `Permission '${permission}' required`,
        },
      });
      return;
    }
  };
}
