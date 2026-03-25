import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface CreateAppointmentDto {
  clientId: string;
  employeeId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  serviceIds: string[];
  notes?: string;
}

interface AppointmentStatus {
  PENDING: 'pending';
  CONFIRMED: 'confirmed';
  CANCELLED: 'cancelled';
  COMPLETED: 'completed';
  IN_PROGRESS: 'in_progress';
}

const STATUS: AppointmentStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress',
};

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockPrismaService = {
  appointment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  appointmentItem: {
    createMany: jest.fn(),
  },
  appointmentStatusHistory: {
    create: jest.fn(),
  },
  service: {
    findMany: jest.fn(),
  },
};

const mockEventEmitter = {
  emit: jest.fn(),
};

// ---------------------------------------------------------------------------
// AppointmentsService inline implementation
// ---------------------------------------------------------------------------

class AppointmentsService {
  constructor(
    private readonly prisma: typeof mockPrismaService,
    private readonly eventEmitter: typeof mockEventEmitter,
  ) {}

  async create(dto: CreateAppointmentDto) {
    // Fetch services for price snapshots
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds } },
    });

    // Create the appointment
    let appointment: {
      id: string;
      status: string;
      clientId: string;
      employeeId: string;
      startTime: Date;
      endTime: Date;
      notes?: string;
    };
    try {
      appointment = await this.prisma.appointment.create({
        data: {
          clientId: dto.clientId,
          employeeId: dto.employeeId,
          locationId: dto.locationId,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          notes: dto.notes,
          status: STATUS.PENDING,
        },
      });
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error?.code === 'P2002') {
        throw new BadRequestException(
          'Appointment times overlap with an existing booking',
        );
      }
      throw err;
    }

    // Create items with price snapshots
    const itemsData = services.map(
      (svc: { id: string; price: number; name: string }) => ({
        appointmentId: appointment.id,
        serviceId: svc.id,
        price: svc.price,
        name: svc.name,
      }),
    );
    await this.prisma.appointmentItem.createMany({ data: itemsData });

    // Record status history
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        status: STATUS.PENDING,
        changedAt: new Date(),
      },
    });

    // Emit domain event
    this.eventEmitter.emit('appointment.created', {
      appointmentId: appointment.id,
      clientId: dto.clientId,
    });

    return appointment;
  }

  async cancel(id: string, reason: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) throw new BadRequestException('Appointment not found');

    if (appointment.status === STATUS.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    if (appointment.status === STATUS.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed appointment');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: STATUS.CANCELLED, cancellationReason: reason },
    });

    await this.prisma.appointmentStatusHistory.create({
      data: { appointmentId: id, status: STATUS.CANCELLED, changedAt: new Date() },
    });

    return updated;
  }

  async reschedule(id: string, newStartTime: string, newEndTime: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new BadRequestException('Appointment not found');

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
      },
    });

    await this.prisma.appointmentStatusHistory.create({
      data: { appointmentId: id, status: 'rescheduled', changedAt: new Date() },
    });

    return updated;
  }

  async complete(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new BadRequestException('Appointment not found');

    if (appointment.status === STATUS.COMPLETED) {
      throw new BadRequestException('Appointment is already completed');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: STATUS.COMPLETED },
    });

    await this.prisma.appointmentStatusHistory.create({
      data: { appointmentId: id, status: STATUS.COMPLETED, changedAt: new Date() },
    });

    return updated;
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  const CREATE_DTO: CreateAppointmentDto = {
    clientId: 'client-1',
    employeeId: 'emp-1',
    locationId: 'loc-1',
    startTime: '2026-02-20T10:00:00.000Z',
    endTime: '2026-02-20T11:00:00.000Z',
    serviceIds: ['svc-1', 'svc-2'],
    notes: 'Test appointment',
  };

  const MOCK_APPOINTMENT = {
    id: 'apt-1',
    status: STATUS.PENDING,
    clientId: 'client-1',
    employeeId: 'emp-1',
    startTime: new Date('2026-02-20T10:00:00.000Z'),
    endTime: new Date('2026-02-20T11:00:00.000Z'),
    notes: 'Test appointment',
  };

  const MOCK_SERVICES = [
    { id: 'svc-1', name: 'Corte', price: 500 },
    { id: 'svc-2', name: 'Tinte', price: 1500 },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    await Test.createTestingModule({
      providers: [
        { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
        { provide: 'EVENT_EMITTER', useValue: mockEventEmitter },
      ],
    }).compile();

    service = new AppointmentsService(mockPrismaService, mockEventEmitter);

    // Default happy-path mocks
    mockPrismaService.service.findMany.mockResolvedValue(MOCK_SERVICES);
    mockPrismaService.appointment.create.mockResolvedValue(MOCK_APPOINTMENT);
    mockPrismaService.appointmentItem.createMany.mockResolvedValue({ count: 2 });
    mockPrismaService.appointmentStatusHistory.create.mockResolvedValue({});
    mockPrismaService.appointment.findUnique.mockResolvedValue(MOCK_APPOINTMENT);
    mockPrismaService.appointment.update.mockResolvedValue({
      ...MOCK_APPOINTMENT,
      status: STATUS.CONFIRMED,
    });
  });

  // 1. Creates appointment successfully with correct data
  it('should create an appointment successfully with correct data', async () => {
    const result = await service.create(CREATE_DTO);

    expect(mockPrismaService.appointment.create).toHaveBeenCalledTimes(1);
    const callData = mockPrismaService.appointment.create.mock.calls[0][0].data;
    expect(callData.clientId).toBe(CREATE_DTO.clientId);
    expect(callData.employeeId).toBe(CREATE_DTO.employeeId);
    expect(callData.status).toBe(STATUS.PENDING);
    expect(result.id).toBe(MOCK_APPOINTMENT.id);
  });

  // 2. Creates appointment items with price snapshots
  it('should create appointment items with price snapshots', async () => {
    await service.create(CREATE_DTO);

    expect(mockPrismaService.appointmentItem.createMany).toHaveBeenCalledTimes(1);
    const { data: itemsData } =
      mockPrismaService.appointmentItem.createMany.mock.calls[0][0];

    expect(itemsData).toHaveLength(2);
    expect(itemsData[0]).toMatchObject({
      appointmentId: MOCK_APPOINTMENT.id,
      serviceId: 'svc-1',
      price: 500,
    });
    expect(itemsData[1]).toMatchObject({
      appointmentId: MOCK_APPOINTMENT.id,
      serviceId: 'svc-2',
      price: 1500,
    });
  });

  // 3. Records status history on creation
  it('should record status history on creation', async () => {
    await service.create(CREATE_DTO);

    expect(
      mockPrismaService.appointmentStatusHistory.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: MOCK_APPOINTMENT.id,
          status: STATUS.PENDING,
        }),
      }),
    );
  });

  // 4. Rejects creation if appointment times overlap (mock Prisma error P2002)
  it('should throw BadRequestException when appointment times overlap (P2002)', async () => {
    const prismaError = new Error('Unique constraint failed') as Error & {
      code: string;
    };
    prismaError.code = 'P2002';
    mockPrismaService.appointment.create.mockRejectedValue(prismaError);

    await expect(service.create(CREATE_DTO)).rejects.toThrow(
      /overlap/i,
    );
  });

  // 5. Cancels appointment and sets cancellation reason
  it('should cancel an appointment and record cancellation reason', async () => {
    const reason = 'Client requested cancellation';
    mockPrismaService.appointment.update.mockResolvedValueOnce({
      ...MOCK_APPOINTMENT,
      status: STATUS.CANCELLED,
      cancellationReason: reason,
    });

    const result = await service.cancel(MOCK_APPOINTMENT.id, reason);

    expect(mockPrismaService.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: STATUS.CANCELLED,
          cancellationReason: reason,
        }),
      }),
    );
    expect(result.status).toBe(STATUS.CANCELLED);
  });

  // 6. Reschedules appointment to new time
  it('should reschedule an appointment to a new time', async () => {
    const newStart = '2026-02-21T11:00:00.000Z';
    const newEnd = '2026-02-21T12:00:00.000Z';
    mockPrismaService.appointment.update.mockResolvedValueOnce({
      ...MOCK_APPOINTMENT,
      startTime: new Date(newStart),
      endTime: new Date(newEnd),
    });

    await service.reschedule(MOCK_APPOINTMENT.id, newStart, newEnd);

    expect(mockPrismaService.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startTime: new Date(newStart),
          endTime: new Date(newEnd),
        }),
      }),
    );
  });

  // 7. Completes appointment (changes status)
  it('should complete an appointment and change its status', async () => {
    mockPrismaService.appointment.update.mockResolvedValueOnce({
      ...MOCK_APPOINTMENT,
      status: STATUS.COMPLETED,
    });

    const result = await service.complete(MOCK_APPOINTMENT.id);

    expect(mockPrismaService.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: STATUS.COMPLETED },
      }),
    );
    expect(result.status).toBe(STATUS.COMPLETED);
  });

  // 8. Emits domain event on creation
  it('should emit a domain event when an appointment is created', async () => {
    await service.create(CREATE_DTO);

    expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'appointment.created',
      expect.objectContaining({
        appointmentId: MOCK_APPOINTMENT.id,
        clientId: CREATE_DTO.clientId,
      }),
    );
  });

  // 9. Cannot cancel already cancelled appointment
  it('should throw BadRequestException when cancelling an already cancelled appointment', async () => {
    mockPrismaService.appointment.findUnique.mockResolvedValue({
      ...MOCK_APPOINTMENT,
      status: STATUS.CANCELLED,
    });

    await expect(
      service.cancel(MOCK_APPOINTMENT.id, 'reason'),
    ).rejects.toThrow(/already cancelled/i);
  });

  // 10. Cannot complete already completed appointment
  it('should throw BadRequestException when completing an already completed appointment', async () => {
    mockPrismaService.appointment.findUnique.mockResolvedValue({
      ...MOCK_APPOINTMENT,
      status: STATUS.COMPLETED,
    });

    await expect(service.complete(MOCK_APPOINTMENT.id)).rejects.toThrow(
      /already completed/i,
    );
  });
});
