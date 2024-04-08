export interface TaskSchedulerProducer {
  handle(event: any, context: any): Promise<void>;
}

export class TaskSchedulerConsumerImpl implements TaskSchedulerProducer {
  constructor() {}

  async handle(event: any, context: any): Promise<void> {
    console.info({
      message: "TaskSchedulerConsumerImpl.handle()",
    });

    console.info(JSON.stringify(event, null, 2));
  }
}

export const handler = new TaskSchedulerConsumerImpl().handle;
