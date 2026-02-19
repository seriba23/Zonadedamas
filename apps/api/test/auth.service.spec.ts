import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  isActive: boolean;
}

interface RefreshTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface UserRole {
  role: {
    permissions: Array<{ permission: { name: string } }>;
  };
}

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockBcrypt = {
  compare: jest.fn(),
  hash: jest.fn(),
};

// ---------------------------------------------------------------------------
// AuthService inline implementation
// ---------------------------------------------------------------------------

class AuthService {
  constructor(
    private readonly prisma: typeof mockPrismaService,
    private readonly jwt: typeof mockJwtService,
    private readonly bcrypt: typeof mockBcrypt,
  ) {}

  private generateTokens(userId: string, tenantId: string) {
    const accessToken = this.jwt.sign(
      { sub: userId, tenantId },
      { expiresIn: '15m' },
    );
    const refreshToken = this.jwt.sign(
      { sub: userId, type: 'refresh' },
      { expiresIn: '30d' },
    );
    return { accessToken, refreshToken };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'passwordHash'>;
  }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.bcrypt.compare(
      password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.tenantId,
    );

    // Store refresh token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt },
    });

    const { passwordHash: _removed, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  }

  async refresh(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify the JWT signature
    let payload: { sub: string; type: string };
    try {
      payload = this.jwt.verify(rawRefreshToken) as { sub: string; type: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Look up the stored token
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: rawRefreshToken },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (storedToken.revokedAt !== null) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Fetch user to get tenantId
    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // Generate new token pair
    const newTokens = this.generateTokens(user.id, user.tenantId);

    // Store new refresh token
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: newTokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return newTokens;
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { token: rawRefreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(
    userId: string,
  ): Promise<Omit<User, 'passwordHash'> & { permissions: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const userRoles: UserRole[] = await this.prisma.userRole.findMany({
      where: { userId },
    });

    const permissions = [
      ...new Set(
        userRoles.flatMap((ur) =>
          ur.role.permissions.map((p) => p.permission.name),
        ),
      ),
    ];

    const { passwordHash: _removed, ...safeUser } = user;
    return { ...safeUser, permissions };
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;

  const MOCK_USER: User = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@example.com',
    firstName: 'María',
    lastName: 'García',
    passwordHash: '$2b$10$hashedpassword',
    isActive: true,
  };

  const MOCK_REFRESH_TOKEN: RefreshTokenRecord = {
    id: 'rtoken-1',
    userId: MOCK_USER.id,
    token: 'valid-refresh-token',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    revokedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    await Test.createTestingModule({
      providers: [
        { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
        { provide: 'JWT_SERVICE', useValue: mockJwtService },
        { provide: 'BCRYPT', useValue: mockBcrypt },
      ],
    }).compile();

    service = new AuthService(mockPrismaService, mockJwtService, mockBcrypt);

    // Default happy-path mocks
    mockJwtService.sign.mockReturnValue('signed-token');
    mockJwtService.verify.mockReturnValue({
      sub: MOCK_USER.id,
      type: 'refresh',
    });
    mockBcrypt.compare.mockResolvedValue(true);

    mockPrismaService.user.findUnique.mockResolvedValue(MOCK_USER);
    mockPrismaService.refreshToken.create.mockResolvedValue(MOCK_REFRESH_TOKEN);
    mockPrismaService.refreshToken.findUnique.mockResolvedValue(
      MOCK_REFRESH_TOKEN,
    );
    mockPrismaService.refreshToken.update.mockResolvedValue({
      ...MOCK_REFRESH_TOKEN,
      revokedAt: new Date(),
    });
    mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaService.userRole.findMany.mockResolvedValue([]);
  });

  // 1. Login with valid credentials returns tokens
  it('should return access and refresh tokens on successful login', async () => {
    const result = await service.login(MOCK_USER.email, 'Password123!');

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('user');
    expect(result.user.email).toBe(MOCK_USER.email);
    // Password hash must not be exposed
    expect((result.user as Record<string, unknown>)).not.toHaveProperty(
      'passwordHash',
    );
    expect(mockPrismaService.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  // 2. Login with invalid email throws UnauthorizedException
  it('should throw UnauthorizedException when email is not found', async () => {
    mockPrismaService.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.login('notfound@example.com', 'password'),
    ).rejects.toThrow(UnauthorizedException);
  });

  // 3. Login with wrong password throws UnauthorizedException
  it('should throw UnauthorizedException when password is incorrect', async () => {
    mockBcrypt.compare.mockResolvedValueOnce(false);

    await expect(
      service.login(MOCK_USER.email, 'WrongPassword!'),
    ).rejects.toThrow(UnauthorizedException);
  });

  // 4. Refresh with valid token returns new token pair
  it('should return a new token pair when refresh token is valid', async () => {
    const result = await service.refresh(MOCK_REFRESH_TOKEN.token);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(mockJwtService.sign).toHaveBeenCalledTimes(2); // access + refresh
  });

  // 5. Refresh rotates token (old token revoked)
  it('should revoke the old refresh token on successful refresh (token rotation)', async () => {
    await service.refresh(MOCK_REFRESH_TOKEN.token);

    // Old token should be revoked
    expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MOCK_REFRESH_TOKEN.id },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    // New token should be stored
    expect(mockPrismaService.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  // 6. Refresh with expired token throws UnauthorizedException
  it('should throw UnauthorizedException when refresh token is expired', async () => {
    const expiredToken: RefreshTokenRecord = {
      ...MOCK_REFRESH_TOKEN,
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
    };
    mockPrismaService.refreshToken.findUnique.mockResolvedValueOnce(
      expiredToken,
    );

    await expect(service.refresh(expiredToken.token)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.refresh(expiredToken.token)).rejects.toThrow(
      /expired/i,
    );
  });

  // 7. Refresh with revoked token throws UnauthorizedException
  it('should throw UnauthorizedException when refresh token has been revoked', async () => {
    const revokedToken: RefreshTokenRecord = {
      ...MOCK_REFRESH_TOKEN,
      revokedAt: new Date(Date.now() - 60_000), // revoked 1 minute ago
    };
    mockPrismaService.refreshToken.findUnique.mockResolvedValueOnce(
      revokedToken,
    );

    await expect(service.refresh(revokedToken.token)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.refresh(revokedToken.token)).rejects.toThrow(
      /revoked/i,
    );
  });

  // 8. Logout revokes the refresh token
  it('should revoke the refresh token on logout', async () => {
    await service.logout(MOCK_REFRESH_TOKEN.token);

    expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          token: MOCK_REFRESH_TOKEN.token,
          revokedAt: null,
        }),
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  // 9. GetMe returns user with resolved permissions
  it('should return user with their resolved permissions from roles', async () => {
    const mockUserRoles: UserRole[] = [
      {
        role: {
          permissions: [
            { permission: { name: 'appointments:read' } },
            { permission: { name: 'clients:read' } },
          ],
        },
      },
      {
        role: {
          permissions: [
            { permission: { name: 'appointments:read' } }, // duplicate — should be deduped
            { permission: { name: 'services:read' } },
          ],
        },
      },
    ];
    mockPrismaService.userRole.findMany.mockResolvedValueOnce(mockUserRoles);

    const result = await service.getMe(MOCK_USER.id);

    expect(result.email).toBe(MOCK_USER.email);
    expect(result.permissions).toContain('appointments:read');
    expect(result.permissions).toContain('clients:read');
    expect(result.permissions).toContain('services:read');
    // Duplicates should be removed
    const apptReadCount = result.permissions.filter(
      (p) => p === 'appointments:read',
    ).length;
    expect(apptReadCount).toBe(1);
    // passwordHash must not be present
    expect((result as Record<string, unknown>)).not.toHaveProperty('passwordHash');
  });
});
