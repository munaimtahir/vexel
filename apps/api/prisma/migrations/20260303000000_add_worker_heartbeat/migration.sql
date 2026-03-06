-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "id" TEXT NOT NULL DEFAULT 'worker-singleton',
    "lastBeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("id")
);
