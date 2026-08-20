import { Injectable, Logger } from '@nestjs/common';
import { Job, JobStatus } from './models/job.model';
import { PrintersService } from '../printers/printers.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly jobs: Map<string, Job> = new Map();
  private readonly queues: Map<string, Job[]> = new Map();
  private readonly processing: Map<string, boolean> = new Map();

  constructor(private readonly printersService: PrintersService) {
    this.queues.set('bixolon', []);
    this.queues.set('xprinter', []);
    this.processing.set('bixolon', false);
    this.processing.set('xprinter', false);
  }

  createJob(printerId: string, type: string, data: any): Job {
    const job: Job = {
      id: `job_${uuidv4()}`,
      printer: printerId,
      type,
      status: 'queued',
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    this.queues.get(printerId)?.push(job);
    
    this.logger.log(`Job created: ${job.id} for printer: ${printerId}`);
    
    this.processQueue(printerId);
    
    return job;
  }

  private async processQueue(printerId: string) {
    if (this.processing.get(printerId)) {
      return;
    }

    const queue = this.queues.get(printerId);
    if (!queue || queue.length === 0) {
      return;
    }

    this.processing.set(printerId, true);

    while (queue.length > 0) {
      const job = queue.shift()!;
      await this.processJob(job);
    }

    this.processing.set(printerId, false);
  }

  private async processJob(job: Job) {
    job.status = 'processing';
    job.startedAt = new Date();
    
    this.logger.log(`Processing job: ${job.id}`);

    try {
      const driver = this.printersService.getDriver(job.printer);
      if (!driver) {
        throw new Error(`Printer ${job.printer} not found`);
      }

      const status = await driver.getStatus();
      if (status.status !== 'ready') {
        throw new Error(`Printer is not ready: ${status.status}`);
      }

      job.status = 'completed';
      job.completedAt = new Date();
      
      this.logger.log(`Job completed: ${job.id}`);
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
      
      this.logger.error(`Job failed: ${job.id} - ${error.message}`);
    }
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }
}
