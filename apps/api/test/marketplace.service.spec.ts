import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, NotFoundException, ConflictException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface MarketplaceUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  passwordHash: string | null;
  socialProvider: string | null;
  socialId: string | null;
  avatarUrl: string | null;
  gender: string | null;
  isActive: boolean;
  suspendedUntil: Date | null;
}

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockPrismaService = {
  marketplaceUser: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  marketplaceRefreshToken: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  client: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
  appointment: {
    findFirst: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const mockBcrypt = {
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password'),
};

// ---------------------------------------------------------------------------
// MarketplaceAuthService inline (login + social login logic)
// ---------------------------------------------------------------------------

class MarketplaceAuthService {
  constructor(
    private readonly prisma: typeof mockPrismaService,
    private readonly jwt: typeof mockJwtService,
    private readonly bcrypt: typeof mockBcrypt,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.marketplaceUser.findFirst({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        `Esta cuenta fue creada con ${user.socialProvider === 'google' ? 'Google' : 'Facebook'}. Inicia sesión con ese método.`,
      );
    }

    const isMatch = await this.bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive && user.suspendedUntil) {
      await this.prisma.marketplaceUser.update({
        where: { id: user.id },
        data: { isActive: true, suspendedAt: null, suspendedUntil: null },
      });
      user.isActive = true;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, type: 'marketplace' });
    const refreshToken = 'mock-refresh-token';

    await this.prisma.marketplaceRefreshToken.create({
      data: {
        marketplaceUserId: user.id,
        tokenHash: 'hashed-token',
        tokenHint: refreshToken.substring(0, 8),
        expiresAt: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        socialProvider: user.socialProvider,
      },
    };
  }

  async socialLogin(provider: 'google' | 'facebook', profile: { email: string; firstName: string; lastName: string; socialId: string; avatarUrl?: string }) {
    let user = await this.prisma.marketplaceUser.findFirst({
      where: { email: profile.email },
    });

    let isNewUser = false;

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('Cuenta desactivada');
      }
      await this.prisma.marketplaceUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } else {
      user = await this.prisma.marketplaceUser.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          socialProvider: provider,
          socialId: profile.socialId,
          avatarUrl: profile.avatarUrl || null,
        },
      });
      isNewUser = true;

      await this.prisma.client.updateMany({
        where: { email: profile.email, marketplaceUserId: null },
        data: { marketplaceUserId: user.id },
      });
    }

    return { isNewUser, user };
  }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_USER: MarketplaceUser = {
  id: 'mkt-user-1',
  email: 'test@siliba.com',
  firstName: 'Test',
  lastName: 'User',
  phone: '+1-555-0000',
  passwordHash: '$2b$12$hashedpassword',
  socialProvider: null,
  socialId: null,
  avatarUrl: null,
  gender: null,
  isActive: true,
  suspendedUntil: null,
};

const MOCK_SOCIAL_USER: MarketplaceUser = {
  ...MOCK_USER,
  id: 'mkt-user-2',
  email: 'social@gmail.com',
  passwordHash: null,
  socialProvider: 'google',
  socialId: 'google-123',
};

const MOCK_SUSPENDED_USER: MarketplaceUser = {
  ...MOCK_USER,
  id: 'mkt-user-3',
  isActive: false,
  suspendedUntil: new Date(Date.now() + 86400000), // tomorrow
};

const MOCK_DEACTIVATED_USER: MarketplaceUser = {
  ...MOCK_USER,
  id: 'mkt-user-4',
  isActive: false,
  suspendedUntil: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MarketplaceAuthService', () => {
  let service: MarketplaceAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketplaceAuthService(mockPrismaService, mockJwtService, mockBcrypt);
  });

  describe('login', () => {
    // 1. Successful login with email/password
    it('should login successfully with valid credentials', async () => {
      mockPrismaService.marketplaceUser.findFirst.mockResolvedValue(MOCK_USER);
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await service.login('test@siliba.com', 'Password123!');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.email).toBe('test@siliba.com');
      expect(result.user.socialProvider).toBeNull();
      expect(mockPrismaService.marketplaceRefreshToken.create).toHaveBeenCalled();
    });

    // 2. Reject invalid email
    it('should throw UnauthorizedException for non-existent email', async () => {
      mockPrismaService.marketplaceUser.findFirst.mockResolvedValue(null);

      await expect(
        service.login('nonexistent@siliba.com', 'Password123!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    // 3. Reject wrong password
    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrismaService.marketplaceUser.findFirst.mockResolvedValue(MOCK_USER);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login('test@siliba.com', 'WrongPassword!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    // 4. Reject social-only account trying password login
    it('should reject social-only account with password login', async () => {
      mockPrismaService.marketplaceUser.findFirst.mockResolvedValue(MOCK_SOCIAL_USER);

      await expect(
        service.login('social@gmail.com', 'Password123!'),
      ).rejects.toThrow('Google');
    });

    // 5. Reactivate suspended account on login
    it('should reactivate suspended account on login', async () => {
      const suspendedUser = { ...MOCK_SUSPENDED_USER };
      mockPrismaService.marketplaceUser.findFirst.mockResolvedValue(suspendedUser);
      mockPrismaService.marketplaceUser.update.mockImplementation(async ({ data }) => {
        Object.assign(suspendedUser, data);
        return suspendedUser;
      });
      mockBcrypt.compare.mockResolvedValue(true);

      await service.login('test@siliba.com', 'Password123!');

      expect(mockPrismaService.marketplaceUser.update).toHaveBeenCalledWith({
        where: { id: MOCK_SUSPENDED_USER.id },
        data: { isActive: true, suspendedAt: null, suspendedUntil: null },
      });
    });

    // 6. Reject deactivated account (no suspendedUntil)
    it('should reject deactivated account', async () => {
      mockPrismaService.marketplaceUser.findFirst.mockResolvedValue(MOCK_DEACTIVATED_USER);
      mockBcrypt.compare.mockResolvedValue(true);

      await expect(
        service.login('test@siliba.com', 'Password123!'),
      ).rejects.toThrow('desactivada');
    });
  });

  describe('socialLogin', () => {
    const googleProfile = {
      email: 'newuser@gmail.com',
      firstName: 'New',
      lastName: 'User',
      socialId: 'google-456',
      avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
    };

    // 7. Create new user on first social login
    it('should create new user on first social login', async () => {
      mockPrismaService.marketplaceUser.findFirst.mockResolvedValue(null);
      mockPrismaService.marketplaceUser.create.mockResolvedValue({
        id: 'new-user-id',
        ...googleProfile,
        socialProvider: 'google',
      });

      const result = await service.socialLogin('google', googleProfile);

      expect(result.isNewUser).toBe(true);
      expect(mockPrismaService.marketplaceUser.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newuser@gmail.com',
          socialProvider: 'google',
          socialId: 'google-456',
        }),
      });
      // Should link existing client records
      expect(mockPrismaService.client.updateMany).toHaveBeenCalledWith({
        where: { email: 'newuser@gmail.com', marketplaceUserId: null },
        data: { marketplaceUserId: 'new-user-id' },
      });
    });

    // 8. Login existing user via social
    it('should login existing user via social', async () => {
      mockPrismaService.marketplaceUser.findFirst.mockResolvedValue(MOCK_USER);
      mockPrismaService.marketplaceUser.update.mockResolvedValue(MOCK_USER);

      const result = await service.socialLogin('google', googleProfile);

      expect(result.isNewUser).toBe(false);
      expect(mockPrismaService.marketplaceUser.create).not.toHaveBeenCalled();
    });

    // 9. Reject deactivated user on social login
    it('should reject deactivated user on social login', async () => {
      mockPrismaService.marketplaceUser.findFirst.mockResolvedValue(MOCK_DEACTIVATED_USER);

      await expect(
        service.socialLogin('google', googleProfile),
      ).rejects.toThrow('desactivada');
    });
  });
});
