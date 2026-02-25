import { ConflictException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from '../appointments.service';

function buildAppointment(overrides: Record<string, any> = {}) {
  return {
    id: 'appt-1',
    tenantId: 'tenant-a',
    patientId: 'patient-1',
    providerId: 'provider-1',
    scheduledAt: new Date('2026-02-24T09:00:00.000Z'),
    durationMinutes: 15,
    reason: null,
    status: 'BOOKED',
    cancelledReason: null,
    notes: null,
    bookedById: 'user-1',
    createdAt: new Date('2026-02-24T08:00:00.000Z'),
    updatedAt: new Date('2026-02-24T08:00:00.000Z'),
    patient: { id: 'patient-1' },
    provider: { id: 'provider-1' },
    opdVisits: [],
    ...overrides,
  };
}

function buildPrisma() {
  return {
    tenantFeature: {
      findUnique: jest.fn().mockResolvedValue({ enabled: true }),
    },
    appointment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

function buildAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

describe('AppointmentsService OPD transitions', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: ReturnType<typeof buildAudit>;
  let service: AppointmentsService;

  beforeEach(() => {
    prisma = buildPrisma();
    audit = buildAudit();
    service = new AppointmentsService(prisma as any, audit as any);
  });

  it('transitions appointment BOOKED -> CHECKED_IN via command and audits', async () => {
    prisma.appointment.findFirst.mockResolvedValueOnce(buildAppointment({ status: 'BOOKED' }));
    prisma.appointment.update.mockResolvedValue(
      buildAppointment({ status: 'CHECKED_IN', checkedInAt: new Date('2026-02-24T09:01:00.000Z') }),
    );

    const result = await service.checkInAppointment('tenant-a', 'appt-1', 'user-1', 'corr-1');

    expect(result.status).toBe('CHECKED_IN');
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'appt-1' },
        data: expect.objectContaining({ status: 'CHECKED_IN', checkedInAt: expect.any(Date) }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'opd.appointment.check_in' }));
  });

  it('returns 409 on invalid appointment command transition (BOOKED -> IN_CONSULTATION)', async () => {
    prisma.appointment.findFirst.mockResolvedValueOnce(buildAppointment({ status: 'BOOKED' }));

    await expect(
      service.startAppointmentConsultation('tenant-a', 'appt-1', 'user-1', 'corr-1'),
    ).rejects.toThrow(ConflictException);

    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('enforces tenant isolation in appointment lookup (cross-tenant reads not found)', async () => {
    prisma.appointment.findFirst.mockResolvedValueOnce(null);

    await expect(service.getAppointment('tenant-a', 'appt-from-tenant-b')).rejects.toThrow(NotFoundException);

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'appt-from-tenant-b', tenantId: 'tenant-a' }),
      }),
    );
  });
});
